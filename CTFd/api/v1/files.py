from typing import List

from flask import request, current_app
from flask_restx import Namespace, Resource
import os
from CTFd.api.v1.helpers.request import validate_args
from CTFd.api.v1.helpers.schemas import sqlalchemy_to_pydantic
from CTFd.api.v1.schemas import APIDetailedSuccessResponse, APIListSuccessResponse
from CTFd.constants import RawEnum
from CTFd.models import Files, db
from CTFd.schemas.files import FileSchema
from CTFd.utils import uploads
from CTFd.utils.decorators import admins_only
from CTFd.utils.helpers.models import build_model_filters
from moviepy.editor import *
from PIL import Image

files_namespace = Namespace("files", description="Endpoint to retrieve Files")

FileModel = sqlalchemy_to_pydantic(Files)


class FileDetailedSuccessResponse(APIDetailedSuccessResponse):
    data: FileModel


class FileListSuccessResponse(APIListSuccessResponse):
    data: List[FileModel]


files_namespace.schema_model(
    "FileDetailedSuccessResponse", FileDetailedSuccessResponse.apidoc()
)

files_namespace.schema_model(
    "FileListSuccessResponse", FileListSuccessResponse.apidoc()
)


@files_namespace.route("")
class FilesList(Resource):
    @files_namespace.doc(
        description="Endpoint to get file objects in bulk",
        responses={
            200: ("Success", "FileListSuccessResponse"),
            400: (
                "An error occured processing the provided or stored data",
                "APISimpleErrorResponse",
            ),
        },
    )
    @validate_args(
        {
            "type": (str, None),
            "location": (str, None),
            "q": (str, None),
            "field": (
                RawEnum("FileFields", {"type": "type", "location": "location"}),
                None,
            ),
        },
        location="query",
    )
    @admins_only
    def get(self, query_args):
        q = query_args.pop("q", None)
        field = str(query_args.pop("field", None))
        filters = build_model_filters(model=Files, query=q, field=field)

        files = Files.query.filter_by(**query_args).filter(*filters).all()
        schema = FileSchema(many=True)
        response = schema.dump(files)

        if response.errors:
            return {"success": False, "errors": response.errors}, 400

        return {"success": True, "data": response.data}


    @files_namespace.doc(
        description="Endpoint to get file objects in bulk",
        responses={
            200: ("Success", "FileDetailedSuccessResponse"),
            400: (
                "An error occured processing the provided or stored data",
                "APISimpleErrorResponse",
            ),
        },
    )
   
    def post(self):
        
        heavyData = False
        # challenge_id
        # page_id
        #max 200000000 + 1 Mb pour le reste des info de la request
        if int(request.headers.get('Content-Length')) > 201000000 and int(request.headers.get('Content-Length')) < 2001000000:
            heavyData = True
        elif int(request.headers.get('Content-Length')) > 2001000000:
            return {
                "success": False,
                "errors": {
                    "location": ["File can't be bigger than 2GB, even with compression. Please use external tools and share it with a link"]
                },
            }, 400


        files = request.files.getlist("file")
        
        # Handle situation where users attempt to upload multiple files with a single location
        if len(files) > 1 and request.form.get("location"):
            return {
                "success": False,
                "errors": {
                    "location": ["Location cannot be specified with multiple files"]
                },
            }, 400

        objs = []
        #on genere un fichier de plus qui seras remplacer par la thumbsnail
        files += files[0],
        vraietype = []
        first = True
        for f in files:
            vraietype += str(f).split('.')[1].split("\'")[0],
            try:
                dico = request.form.to_dict()
                dico["first"] = first
                obj = uploads.upload_file(file=f, **dico)
                first = False
                
            except ValueError as e:
                return {
                    "success": False,
                    "errors": {"location": [str(e)]},
                }, 400
            objs.append(obj)
        
        schema = FileSchema(many=True)
        response = schema.dump(objs)
        
        width = 800
        fps = 24
        if (heavyData):
            width = 500
            fps = 15
        size = 0
        for i in range(len(files)):
            response.data[i]["location"] = response.data[i]["location"].split('.')[0] + "." +vraietype[i].lower()
            path = current_app.config.get("UPLOAD_FOLDER")+"/"+response.data[i]["location"]
            try:
                size += os.path.getsize(path)
            except:
                #il tente de parcourire les fichier temporaire
                size += 0
        
        for i in range(len(files)):
            response.data[i]["location"] = response.data[i]["location"].split('.')[0] + "." +vraietype[i].lower()
            response.data[i]["type"] = str(files[i]).split('\'')[3]
            path = current_app.config.get("UPLOAD_FOLDER")+"/"+response.data[i]["location"]
            directory = ""
            for x in path.split('/')[0:-1]:
                directory += "/"+x
           
            #opperation a effectuer seulement sur la thumbsnail:
            if i == 0:
                if response.data[i]["type"].find("video") != -1:
                    clip = VideoFileClip(path)
                    
                    os.remove(path)
                    path = path.split('.')[0]+".png"
                    clip.save_frame(path, t = 1)
                    
                    response.data[i]["type"] = "image/png"
                #we also want to reduce the size of videos thumbsnail
                if response.data[i]["type"].find("image") != -1:
                    image = Image.open(path)
                    os.remove(path)
                    #same as image.resize but keeping the ratio ;-)
                    if not request.args.get("admin", False):
                        image.thumbnail((50, 50))
                    image.save(path.split('.')[0]+".png")
                    response.data[i]["type"] = "thumbsnail"
                    response.data[i]["location"] = response.data[i]["location"].split('.')[0]+".png"
            else:
                if response.data[i]["type"].find("video") != -1:
                    clip = VideoFileClip(path)
                    
                    os.remove(path)
                    
                    
                    print(clip.w)
                    print(clip.h)
                    clip_resized = clip.resize((width*(clip.size[1]/clip.size[0]), width))
                    
                    clip_resized = clip_resized.set_fps(fps) 
                    clip_resized.write_videofile(path.split('.')[0]+".webm", codec="libvpx")
                    
                    
                    response.data[i]["type"] = "video/webm"
                    response.data[i]["location"] = response.data[i]["location"].split('.')[0]+".webm"
                
                elif response.data[i]["type"].find("image") != -1:
                    
                    image = Image.open(path)
                    os.remove(path)
                    #same as image.resize but keeping the ratio ;-)
                    if not request.args.get("admin", False):
                        image.thumbnail((width,width*(image.size[1]/image.size[0])))
                    image.save(path.split('.')[0]+".png")
                    response.data[i]["type"] = "image/png"
                    response.data[i]["location"] = response.data[i]["location"].split('.')[0]+".png"
            
        
        if response.errors:
            return {"success": False, "errors": response.errors}, 400

        return {"success": True, "data": response.data}
    


@files_namespace.route("/<file_id>")
class FilesDetail(Resource):

    @files_namespace.doc(
        description="Endpoint to get a specific file object",
        responses={
            200: ("Success", "FileDetailedSuccessResponse"),
            400: (
                "An error occured processing the provided or stored data",
                "APISimpleErrorResponse",
            ),
        },
    )
    def get(self, file_id):
        f = Files.query.filter_by(id=file_id).first_or_404()
        schema = FileSchema()
        response = schema.dump(f)

        if response.errors:
            return {"success": False, "errors": response.errors}, 400

        return {"success": True, "data": response.data}

    @files_namespace.doc(
        description="Endpoint to delete a file object",
        responses={200: ("Success", "APISimpleSuccessResponse")},
    )
    def delete(self, file_id):
        f = Files.query.filter_by(id=file_id).first_or_404()

        uploads.delete_file(file_id=f.id)
        db.session.delete(f)
        db.session.commit()
        db.session.close()

        return {"success": True}
