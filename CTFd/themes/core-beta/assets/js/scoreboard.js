import Alpine from "alpinejs";
import CTFd from "./index";
import { getOption, getTenLast } from "./utils/graphs/echarts/scoreboard";
import { embed } from "./utils/graphs/echarts";
import * as echarts from 'echarts';
import { ezAlert } from "./compat/ezq";
import { default as helpers } from "./compat/helpers";

window.Alpine = Alpine;
window.CTFd = CTFd;
window.ScoreboardDetail = 0;
window.standings = 0;
window.nbStandings = 0;
window.scoreboardListLoaded = false;
window.allImages = [];
//start at 0 cause we call increasing methodes on start so maxCountIncrease also = starting value
window.maxCount = 0;
window.maxCountIncrease = 5;
window.imageInit = false;
window.theninit = 0;

Alpine.data("ScoreboardDetail", () => ({
  data: {},
  show: true,
  
  async init() {
    window.standings = await CTFd.pages.scoreboard.getScoreboard();
    window.ScoreboardDetail = await CTFd.pages.scoreboard.getScoreboardDetail(window.standings.length)
    console.log("await over")
    console.log(window.ScoreboardDetail)
    let option = getOption(CTFd.config.userMode, window.standings);
    var chartDom = document.getElementById('score-graph');
    embed(chartDom, option);
    
    this.show = window.standings.length > 0;

  },
}));

Alpine.data("ScoreboardList", () => ({
  standings: [],
  brackets: [],
  activeBracket: null,
    
    async init() {
      //We are wating for those value to be loaded so we dont have to load them twice
      
        let responseBrackets = await CTFd.fetch(`/api/v1/brackets?type=${CTFd.config.userMode}`, {
          method: "GET",
        });
        const bodyBrackets = await responseBrackets.json();
        this.brackets = bodyBrackets["data"];
        

        let responseChallenges= await CTFd.fetch(`/api/v1/challenges`, {
          method: "GET",

        });
        const bodyChallenges = await responseChallenges.json();

        
        let ChallengeIdToChallengeName = {}
        for (let i = 0; i < bodyChallenges["data"].length; i++){
          ChallengeIdToChallengeName[bodyChallenges["data"][i]["id"]] = bodyChallenges["data"][i]["name"];
        }
        if (window.ScoreboardDetail == 0 || window.standings == 0){
          this.init();
        }
        else {
          let last = getTenLast(window.ScoreboardDetail, window.standings, ChallengeIdToChallengeName);
          for (let i = 0; i < last.length; i++){
            this.standings[i] = last[i];
          }
        }
        window.nbStandings = this.standings.length;
      
    
    
    
    
  },
}));





Alpine.data("LogImage", () => ({
  
  async init() {
    window.allImages.push(this.id);
    if (window.allImages.length > window.maxCount){
      document.getElementById(this.id).hidden = true
    }
    
    if (window.allImages.length == window.maxCountIncrease || window.allImages.length == window.nbStandings){
      if (!window.imageInit){

        window.imageInit = true;
        self.show10More();
      }
      
      
      
    }
  },
}));


this.show10More = async function(e){
  let imageToPull = [];
  for (let i = window.maxCount; i < window.maxCount+window.maxCountIncrease; i++){
    if (window.allImages[i]){
      imageToPull.push(window.allImages[i]);
      document.getElementById(window.allImages[i]).hidden = false;
    }
    
  }
  
  let responseChallengesMedia= await CTFd.fetch(`/api/v1/teams?ids=`+JSON.stringify(imageToPull), {
    method: "GET",
  });
  
  const bodyChallengesMedia = await responseChallengesMedia.json();

  
  for (let i = 0; i < window.maxCountIncrease; i++){
    if (maxCount + i < window.allImages.length){
      let provide = bodyChallengesMedia["data"][i]["provided"];
      let element = document.getElementById(window.allImages[i+window.maxCount]);
  
      let mediaContents;
      try {
        mediaContents = JSON.parse(provide);
      } catch {}
      //si media content est defis c que le provied est des photos/video
      //sinon c autre chose genre du texte
      if (mediaContents) {
        let thumbsnailAvailable = false;
        for (let i = 0; i < mediaContents.length; i++) {
          if (mediaContents[i]["type"] == "thumbsnail") {
            thumbsnailAvailable = true;
            let thumbsnail = createMediaElement(mediaContents[i]);
            thumbsnail.style.width = "50px";
            thumbsnail.style.height = "auto";
            element.getElementsByClassName("imageContainer")[0].appendChild(thumbsnail);
            element.getElementsByClassName("imageContainer")[0].onclick = showLargeSubmissions;
            element.value = provide;
          }
        }
        if (!thumbsnailAvailable) {
          let text = document.createElement("p");
          text.textContent = "No thumbsnail Available for the current media";
          element.getElementsByClassName("imageContainer")[0].appendChild(text);
        }
      } else {
        //veut pas forcement afficher les reponse ecrit
        
        //let text = document.createElement("p");
        //text.textContent = provide;
        //element.appendChild(text);
      }
    }
    


    
    
    //document.getElementById(window.allImages[i+window.maxCount]).onclick = showLargeSubmissions;
  }
  window.maxCount += window.maxCountIncrease;
  if (window.allImages.length <= window.maxCount){
    document.getElementById("plus-btn").disabled = true;
    
  }
};
this.createMediaElement = function(mediaContent) {

  let htmlElement;
  if (mediaContent["type"] == "video/mp4") {
    htmlElement = document.createElement("video");
    htmlElement.controls = true;
    htmlElement.type = "video/mp4";
  } else if (
    mediaContent["type"] == "image/png" ||
    mediaContent["type"] == "thumbsnail"
  ) {
    htmlElement = document.createElement("img");
    htmlElement.type = "image/png";
  }
  htmlElement.src = "/files/" + mediaContent["location"];

  return htmlElement;
}

this.showLargeSubmissions = function(_event) {
  window.carouselPosition = 0;
  let mediaContents;
  let element;

  try {
    mediaContents = JSON.parse(_event.srcElement.parentElement.value);
    element = _event.srcElement.parentElement;
  } catch {
    mediaContents = JSON.parse(_event.srcElement.parentElement.parentElement.value);
    element = _event.srcElement.parentElement.parentElement;
  }

  let decalage = false;
  let images = mediaContents;

  window.carouselMax = mediaContents.length - 1;
  let imagesHTML =
    "<section class='slider-wrapper'><ul class='slides-container list-unstyled' style:'list-style: none !important;' id='slides-container'>";
  for (let i = 0; i < mediaContents.length; i++) {
    if (mediaContents[i]["type"] != "thumbsnail") {
      let element = createMediaElement(mediaContents[i]);
      element.style.width = "100%";
      element.style.objectFit = "contain";
      element.style.height = "500px";

      let lambda = document.createElement("div");
      lambda.append(element);
      imagesHTML +=
        `<li class="slide ` +
        (decalage ? i - 1 : i) +
        "slide" +
        `" style="min-height:50%">`;
      imagesHTML += lambda.innerHTML;
      imagesHTML += `</li>`;
    } else {
      decalage = true;
    }
  }
  imagesHTML += "</ul></section>";
  imagesHTML += "<img src onerror='reloadCarousel(this.parentElement);'></img>"
  imagesHTML += "<button class='btn btn-primary carousel__navigation-button slide-arrow-prev' id='slide-arrow-prev' onclick='downCarousel(this)' style='display:block;position:absolute;top:40%;left:1rem;'>" +
    `<svg viewBox="0 0 100 100"><path d="M 50,0 L 60,10 L 20,50 L 60,90 L 50,100 L 0,50 Z" class="arrow" fill="white" transform="translate(15,0) rotate(0)"></path></svg>` +
    "</button>";
  imagesHTML += "<button style='position:absolute;top:40%;right:1rem;' class='btn btn-primary carousel__navigation-button slide-arrow-next' id='slide-arrow-next' onclick='upCarousel(this)'>" +
  `<svg viewBox="0 0 100 100"><path d="M 50,0 L 60,10 L 20,50 L 60,90 L 50,100 L 0,50 Z" class="arrow" fill="white" transform="translate(85,100) rotate(180)"></path></svg>` +
  "</button>";

  ezAlert({
      title: "Visioneurs",
      body:imagesHTML,
      button: "retour",
      ids: element.id,
      additionalClassMain: "FullSizeCarousel",
  }, helpers, CTFd.user);
  document.getElementsByClassName("modal-dialog")[0].style.listStyle = "none";
}
window.upCarousel = function (self) {
  window.carouselPosition += 1;
  if (window.carouselPosition != window.carouselMax - 1) {
    window.reloadCarousel(self.parentElement);
    self.parentElement.getElementsByClassName("slide-arrow-prev")[0].hidden =
      false;
  } else {
    window.reloadCarousel(self.parentElement);
    self.parentElement.getElementsByClassName("slide-arrow-next")[0].hidden =
      true;
    self.parentElement.getElementsByClassName("slide-arrow-prev")[0].hidden =
      false;
  }
};
window.downCarousel = function (self) {
  window.carouselPosition -= 1;

  if (window.carouselPosition != 0) {
    window.reloadCarousel(self.parentElement);
    self.parentElement.getElementsByClassName("slide-arrow-next")[0].hidden =
      false;
  } else {
    window.reloadCarousel(self.parentElement);
    self.parentElement.getElementsByClassName("slide-arrow-prev")[0].hiddend =
      true;
    self.parentElement.getElementsByClassName("slide-arrow-next")[0].hidden =
      false;
  }
};
window.reloadCarousel = function (element) {
  if (window.carouselPosition == 0) {
    element.getElementsByClassName("slide-arrow-prev")[0].hidden = true;
  }
  if (window.carouselMax == 1) {
    element.getElementsByClassName("slide-arrow-next")[0].hidden = true;
  }

  for (let i = 0; i < window.carouselMax; i++) {
    if (i == window.carouselPosition) {
      element.getElementsByClassName(i + "slide")[0].hidden = false;
    } else {
      element.getElementsByClassName(i + "slide")[0].hidden = true;

      let child = element.getElementsByClassName(i + "slide")[0].firstChild;

      if (child.nodeName == "VIDEO") {
        child.pause();
      }
    }
  }
};

Alpine.start();
