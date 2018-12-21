var app = angular.module("infinimgur", []);

app.factory("ImgurImage", function($q, $http) {
  var ImgurImage = function(id) {
    var self = this;
    self.id = id;
    self.thumbnail = "https://i.imgur.com/" + self.id + "s.jpg";
    self.image = "https://i.imgur.com/" + self.id + ".png"; // extension unknown
    self.page = "https://imgur.com/" + self.id + "/";
  }

  ImgurImage.prototype.fetch = function() {
    var self = this;

    return $q(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        if ((img.width == 198 && img.height == 160) ||
            (img.width == 161 && img.height == 81)) {
          reject();
        } else {
          resolve(self);
        }
      }
      img.onerror = function() {
        reject();
      }

      img.src = "//i.imgur.com/" + self.id + "s.jpg";
    });
  }

  return ImgurImage;
});

app.factory("ImgurRoulette", function($q, ImgurImage) {
  var ImgurRoulette = function(concurrency) {
    var self = this;
    self.concurrency = concurrency || 5;
    self.idChance = 0.2;

    self.attempts = 0;
    self.successfulAttempts = 0;
    self.failedAttempts = 0;
  }

  ImgurRoulette.prototype.generateID = function() {
    var length = (Math.random() > self.idChance) ? 5 : 7;
    return Math.random().toString(36).substr(0, length - 0);
  }

  ImgurRoulette.prototype.attempt = function() {
    var self = this;
    return $q(function(resolve, reject) {
      var id = self.generateID();
      self.attempts++;
      var image = new ImgurImage(id);
      image.fetch()
      .then(function() {
        self.successfulAttempts++;
        resolve(image);
      }, function() {
        self.failedAttempts++;
        reject(image);
      });
    })
  }

  ImgurRoulette.prototype.attemptConcurrent = function() {
    var self = this;
    return $q(function(resolve, reject) {
      var foundImages = [];
      var attempted = 0;
      for (var i = 0; i < self.concurrency; i++) {
        self.attempt()
        .then(function(image) {
          foundImages.push(image);
          if (++attempted >= self.concurrency) resolve(foundImages);
        }, function(image) {
          if (++attempted >= self.concurrency) resolve(foundImages);
        });
      }
    });
  }

  ImgurRoulette.prototype.attemptUntil = function(count) {
    var self = this;
    return $q(function(resolve, reject) {
      var foundImages = [];
      self.attemptConcurrent()
      .then(function(images) {
        foundImages = foundImages.concat(images);
        if (foundImages.length < count) {
          setTimeout(function() {
            self.attemptUntil(count - foundImages.length)
            .then(function(images) {
              foundImages = foundImages.concat(images);
              resolve(foundImages);
            });
          }, 0);
        } else {
          resolve(foundImages);
        }
      });
    })
  }

  return ImgurRoulette;
});

app.controller("RouletteCtrl", function($scope, $interval, ImgurRoulette) {
  $scope.busy = false;
  $scope.images = [];
  $scope.roulette = new ImgurRoulette();
  $scope.rateLimit = 1000;
  $scope.successRate = 0;
  $scope.disclaimerDismissed = false;

  $scope.wantsMore = function() {
    var el = document.documentElement;
    var pageHeight = el.clientHeight;
    var scrollHeight = el.scrollHeight;
    var scrollTop = el.scrollTop;

    return scrollTop >= scrollHeight - pageHeight * 1.5;
  }

  $scope.loadMore = function() {
    $scope.busy = true;
    $scope.roulette.attemptUntil(5)
    .then(function(images) {
      images.forEach(function(image) { $scope.images.push(image); })
      if ($scope.wantsMore())
        setTimeout($scope.loadMore, $scope.rateLimit);
      else
        $scope.busy = false;
    }, function() {
      $scope.busy = false;
    });
  }

  $scope.shrinkThumbnail = function(thumb)
  {
    var img = thumb.find("img");
    var id = thumb.attr("id");
    thumb.removeClass("expanded z-2");
    img.attr("src", "https://i.imgur.com/" + id + "s.jpg");
  }

  $scope.expandThumbnail = function(thumb)
  {
    $scope.shrinkThumbnail($(".thumbnail.expanded"));
    var img = thumb.find("img");
    var id = thumb.attr("id");
    thumb.addClass("expanded z-2");
    img.attr("src", "https://i.imgur.com/" + id + ".png");
  }

  $scope.toggleThumbnail = function(thumb) {
    var $thumb = $(thumb);
    if ($thumb.hasClass("expanded")) {
      $scope.shrinkThumbnail($thumb);
    } else {
      $scope.expandThumbnail($thumb);
    }
  }  

  function intervalHandler() {
    if (!$scope.disclaimerDismissed) return;
    if (!$scope.busy && $scope.wantsMore())
      $scope.loadMore();
    $scope.successRate = Math.floor(($scope.roulette.successfulAttempts / $scope.roulette.attempts) * 100);
  }

  $interval(intervalHandler, 500);
});

app.run(function() {
  $(window).on("keydown", function(e) {
    if (e.which != 37 && e.which != 39) return;
    e.preventDefault();

    var thumb = $(".thumbnail.expanded");
    if (thumb.length) {
      var prev = thumb.prev();
      var next = thumb.next();
    } else {
