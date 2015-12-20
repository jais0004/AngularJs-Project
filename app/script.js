//declare the angular app and additional libary to be used in project
var module = angular.module('UhearoApp', ['ngRoute', 'ngResource']);

//declare header variable for authentication 
var authHeader = 'Access-Token';

//decalare variable with API url
var urlBase = 'https://uhearo-api-alpha.herokuapp.com/api/v1';

//custom directive for password verify
module.directive("passwordVerify", function() {
    return {
        require: "ngModel",
        scope: {
            passwordVerify: '='
        },
        link: function(scope, element, attrs, ctrl) {
            scope.$watch(function() {
                var combined;

                if (scope.passwordVerify || ctrl.$viewValue) {
                    combined = scope.passwordVerify + '_' + ctrl.$viewValue;
                }
                return combined;
            }, function(value) {
                if (value) {
                    ctrl.$parsers.unshift(function(viewValue) {
                        var origin = scope.passwordVerify;
                        if (origin !== viewValue) {
                            ctrl.$setValidity("passwordVerify", false);
                            return undefined;
                        } else {
                            ctrl.$setValidity("passwordVerify", true);
                            return viewValue;
                        }
                    });
                }
            });
        }
    };
});

//decalre global variable and getter and setter in angular js service 
module.service('searchString', function() {
    var value = "Log In";

    return {
        getProperty: function() {
            return value;
        },
        setProperty: function(v) {
            value = v;
        }
    };
});

//configure Angular Js route provider with different path with corresponding template and controller
module.config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/Browser', {
        templateUrl: 'pages/Browsers.html',
        controller: 'BrowserController'

    }).when('/Browsers', {
        templateUrl: 'pages/Articles.html',
        controller: 'ArticlesController'
    }).when('/Narrators', {
        templateUrl: 'pages/Narrators.html',
        controller: 'NarratorsController'
    }).when('/YourNarrations', {
        templateUrl: 'pages/YourNarrations.html',
        controller: 'YourNarrationsController'
    }).when('/Pages/:id', {
        templateUrl: 'pages/Pages.html',
        controller: 'PagesController'
    }).when('/register', {
        templateUrl: 'pages/signup.html',
        controller: 'registerController'
    }).when('/login', {
        templateUrl: 'pages/login.html',
        controller: 'loginController'
    }).otherwise({
        redirectTo: '/Browser'
    });
}]).run( // restrict acces when user is not signed in
    function($rootScope, $location, $http, voiceItAuth) {
        $rootScope.$on("$routeChangeStart", function(event, next, current) {
			//check if user is log in
			if (!voiceItAuth.secret) {

                var nextUrl = next.$$route.originalPath;
				//Allow the path if user is not logged in
                if (nextUrl == '/Browser' || nextUrl == '/login' || nextUrl == '/register') {

                } else {
                    $location.path("/login");
                }
            }


        });
    });

//factory configuration for header and api url	
module.factory('apiConfig', function() {
        return {
            authHeader: authHeader,
            urlBase: urlBase
        }
    })//factory configuration for user
    .factory('user', function($resource, voiceItAuth, $location) {
        return $resource(urlBase + '/users/:id', {
            id: '@id'
        }, {
            // credentials object
            login: {
                method: 'POST',
                url: urlBase + '/tokens',
                responseType: 'json',
                interceptor: {
                    response: function(response) {
                        // after successful login . direct the user to home page
                        $location.path("/home");
						//store accesstoken
                        var accessToken = response.data
                        voiceItAuth.setUser(accessToken.secret, accessToken.UserId, accessToken.user)
                        voiceItAuth.rememberMe = response.config.params.rememberMe !== false
                        voiceItAuth.save()
                        return response.resource
                    }
                }
            }
        })
    })//attach access token to header once the user is logged in
    .config(['$httpProvider',
        function($httpProvider) {
            $httpProvider.interceptors.push('voiceItAuthRequestInterceptor')
        }
    ])//factory configuration for narrations
    .factory('narration', function($resource) {
        return $resource(urlBase + '/narrations/:id', {
            id: '@id'
        }, {
            
            star: {
                method: 'POST',
                url: urlBase + '/stars',
                responseType: 'json'
            },
            unStar: {
                method: 'DELETE',
                url: urlBase + '/stars',
                responseType: 'json'
            }
        })
    })//factory configuration for narrations
    .factory('comment', function($resource) {
        return $resource(urlBase + '/comments/:id')
    })//factory configuration for narrations
    .factory('article', function($resource) {
        return $resource(urlBase + '/articles/:id')
    })//factory configuration for narrations
    .factory('stars', function($resource) {
        return $resource(urlBase + '/comments/:id')
    })
    // auth service uses localstore or cookies
    .factory('voiceItAuth', function() {
        var props = ['secret', 'currentUserId']
        var propsPrefix = '$voiceIt$'

        function VoiceItAuth() {
            var self = this
            props.forEach(function(name) {
                self[name] = load(name)
            })
            this.rememberMe = undefined
            this.currentUserData = null
        }

        VoiceItAuth.prototype.save = function() {
            var self = this
            var storage = this.rememberMe ? localStorage : sessionStorage
            props.forEach(function(name) {
                save(storage, name, self[name])
            })
        }

        VoiceItAuth.prototype.setUser = function(secret, userId, userData) {
            this.secret = secret
            this.currentUserId = userId
            this.currentUserData = userData
        }

        VoiceItAuth.prototype.clearUser = function() {
            this.secret = null
            this.currentUserId = null
            this.currentUserData = null
        }

        VoiceItAuth.prototype.clearStorage = function() {
            props.forEach(function(name) {
                save(sessionStorage, name, null)
                save(localStorage, name, null)
            })
        }

        return new VoiceItAuth()

        // Note: LocalStorage converts the value to string
        // We are using empty string as a marker for null/undefined values.
        function save(storage, name, value) {
            var key = propsPrefix + name
            if (value === null) value = ''
            storage[key] = value
        }

        function load(name) {
            var key = propsPrefix + name
            return localStorage[key] || sessionStorage[key] || null
        }
    })
    // adds the interceptor to the stack
    .config(['$httpProvider',
        function($httpProvider) {
            $httpProvider.interceptors.push('voiceItAuthRequestInterceptor')
        }
    ]).factory('voiceItAuthRequestInterceptor', ['$q', 'voiceItAuth', '$location',
        function($q, voiceItAuth, $location) {
            return {
                'request': function(config) {
                    // filter out non urlBase requests
                    if (config.url.substr(0, urlBase.length) !== urlBase) {
                        return config
                    }

                    if (voiceItAuth.secret) {

                        config.headers[authHeader] = voiceItAuth.secret
                    } else if (config.__isGetCurrentUser__) {
                        // Return a stub 401 error for User.getCurrent() when
                        // there is no user logged in
                        var res = {
                            body: {
                                error: {
                                    status: 401
                                }
                            },
                            status: 401,
                            config: config,
                            headers: function() {
                                return undefined
                            }
                        }
                        return $q.reject(res)
                    }
                    return config || $q.when(config)
                }
            }
        }
    ]);

//controller for index page and adding the additional function searchString, voiceItAuth
module.controller("first", function($scope, searchString, voiceItAuth) {
	//if user is logged in, assign userStatus as Log in else assign it as Log out
    if (voiceItAuth.secret) {
        $scope.userStaus = "Log out";
    } else {
        $scope.userStaus = "Log In"
    }

});

//controller for home page and adding the additional function $location, article, searchString, voiceItAuth
module.controller("BrowserController", function($scope, $location, article, searchString, voiceItAuth) {
    $scope.query = searchString.getProperty();
	//if user is logged in, assign userStatus as Log in else assign it as Log out
    if (voiceItAuth.secret) {
        $scope.userStaus = "Log out";
    } else {
        $scope.userStaus = "Log In"
    }
//if user is logged in, user is routed to Logout , if user is logged out the user is routed to log out
    $scope.loginorlogout = function() {
        if (voiceItAuth.secret) {
            voiceItAuth.setUser(null, null, null);
            $location.path("/login");
        } else {
            $location.path("/login");
        }
    }
	//REST api call to get all articles
    $scope.spotlights = article.query();
	
	//click on article , route it to new page with full article with narrations
    $scope.articleClick = function(article) {
		$location.path("/Pages/" + article.id);

    };
});

//Controller for page html and adding the additional function $routeParams, article, $http, filterFilter
module.controller("PagesController", function($scope, $routeParams, article, $http, filterFilter) {
	
	//get id of the clicked article
    $scope.artcileid = $routeParams.id;
    $scope.filteredArray = [];
	//temporary method to get the list of uploaded narration
    $http.get('upload/' + $scope.artcileid + '/upload.json')
        .then(function(res) {

            $scope.upload = res.data;

        });
   
	//setup audio player
    AudioJS.setupAllWhenReady();
	
	//get the path of selected narration
    $scope.pathSelected = function(p) {
        $scope.selected = true;
        console.log(p);
        $scope.path = p;
    };


	
   



	//get description and other details for selected article
    $scope.articles = article.get({
        id: $scope.artcileid
    }, function() {
        console.log($scope.articles);
    });
});

//controller for register page and additional functions user & location 
module.controller("registerController", function($scope, user, $location) {
	//declare error msg
    $scope.errormsg = "";
	//create a new user
    $scope.u = new user();
	//function loginuser connect to REST api
    $scope.loginuser = function(d) {
        $scope.u = {
            "email": d.username,
            "password": d.password,
            "firstName": d.firstName,
            "lastName": d.lastName
        };
		//POST the request to REST api
        user.save($scope.u, function(response) {
            $location.path("/login");
        }, function(error) {
			//if there is error , set the error to true
            $scope.error = true;	
            $scope.errormsg = error.data.errors[0].field;

        });


    };



});

//controller for login page and additional functions user, voiceItAuth, $location
module.controller("loginController", function($scope, user, voiceItAuth, $location) {
	
	//logout function setting the secret key to null
    $scope.logout = function() {

        voiceItAuth.setUser(null, null, null)


    };
	
	//function loginuser connect to REST api
    $scope.loginuser = function(u) {
        user.login({
            credentials: {
                email: u.username,
                password: u.password
            }
        })

    };




});

//controller for Article page and additional functions location, article, searchString, voiceItAuth
module.controller("ArticlesController", function($scope, $location, article, searchString, voiceItAuth) {
	//if user is logged in, assign userStatus as Log in else assign it as Log out
    if (voiceItAuth.secret) {
        $scope.userStaus = "Log out";
    } else {
        $scope.userStaus = "Log In"
    }
//if user is logged in, user is routed to Logout , if user is logged out the user is routed to log out
    $scope.loginorlogout = function() {
        if (voiceItAuth.secret) {
            voiceItAuth.setUser(null, null, null);
            $location.path("/login");
        } else {
            $location.path("/login");
        }
    }
	
//REST api call to get all articles	
    $scope.spotlights = article.query();
	
//click on article , route it to new page with full article with narrations
$scope.articleClick = function(article) {


        $location.path("/Pages/" + article.id);

    };
});
//Controller for Narrations page and adding the additional function $routeParams, article, $http, filterFilter
module.controller("NarratorsController", function($scope, $location, article, searchString, voiceItAuth) {
	//if user is logged in, assign userStatus as Log in else assign it as Log out
    if (voiceItAuth.secret) {
        $scope.userStaus = "Log out";
    } else {
        $scope.userStaus = "Log In"
    }
//if user is logged in, user is routed to Logout , if user is logged out the user is routed to log out
    $scope.loginorlogout = function() {
        if (voiceItAuth.secret) {
            voiceItAuth.setUser(null, null, null);
            $location.path("/login");
        } else {
            $location.path("/login");
        }
    }
});

//Controller for YourNarration page html and adding the additional function location, article, searchString, voiceItAuth
module.controller("YourNarrationsController", function($scope, $location, article, searchString, voiceItAuth) {
//if user is logged in, assign userStatus as Log in else assign it as Log out
if (voiceItAuth.secret) {
        $scope.userStaus = "Log out";
    } else {
        $scope.userStaus = "Log In"
    }
//if user is logged in, user is routed to Logout , if user is logged out the user is routed to log out
    $scope.loginorlogout = function() {
        if (voiceItAuth.secret) {
            voiceItAuth.setUser(null, null, null);
            $location.path("/login");
        } else {
            $location.path("/login");
        }
    }
});