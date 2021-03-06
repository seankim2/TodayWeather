/**
 * Created by aleckim on 2016. 5. 1..
 * alarmInfo(pushInfo)를 구분하는 것은 cityIndex보다는 town object가 적합하지만, string의 부담때문에 cityIndex를 구분으로 쓰고 있음.
 * city의 index가 변경가능하게 수정되면 이부분도 꼭 수정되어야 함 backend도 수정필요함.
 */

angular.module('service.push', [])
    .factory('Push', function($http, TwStorage, Util, WeatherUtil, WeatherInfo, $location, Units) {
        var obj = {};
        obj.config = {
            "android": {
                "senderID": twClientConfig.googleSenderId
                //"icon": "TodayWeather",
                //"iconColor": "blue"
                //"forceShow": true,
            },
            "ios": {
                "alert": "true",
                "badge": "true",
                "sound": "true",
                "clearBadge": "true"
            },
            "windows": {}
        };

        obj.pushUrl = twClientConfig.serverUrl + '/v000705'+'/push';

        //attach push object to the window object for android event
        //obj.push;

        //obj.alarmInfo = {'time': new Date(0), 'cityIndex': -1, 'town': {'first':'','second':'', 'third':'}};
        obj.pushData = {registrationId: '', type: '', alarmList: []};
        //obj.registrationId;
        //obj.type; //'ios' or 'android'
        //obj.alarmList = [];

        /**
         * units 변경시에 push 갱신 #1845
         */
        obj.updateUnits = function () {
            var self = this;
            if (self.pushData.alarmList.length > 0) {
                Util.ga.trackEvent('push', 'update', 'units');
                self.pushData.alarmList.forEach(function (alarmInfo) {
                    self._postPushInfo(alarmInfo);
                });
            }
        };

        obj.loadPushInfo = function () {
            var self = this;
            var pushData = TwStorage.get("pushData");
            if (pushData != null) {
                self.pushData.registrationId = pushData.registrationId;
                self.pushData.type = pushData.type;
                self.pushData.alarmList = pushData.alarmList;
                self.pushData.alarmList.forEach(function (alarmInfo) {
                    alarmInfo.time = new Date(alarmInfo.time);
                });

                //update alarmInfo to server for sync
                if (self.pushData.alarmList.length > 0) {
                    setTimeout(function() {
                        self.pushData.alarmList.forEach(function (alarmInfo) {
                            self._postPushInfo(alarmInfo);
                        });
                    }, 3000);
                }
            }
            console.log('load push data');
            console.log(self);
        };

        obj.savePushInfo = function () {
            var self = this;
            console.log('save push data');
            TwStorage.set("pushData", self.pushData);
        };

        /**
         * loadPushInfo로 데이터를 읽어온 경우 time은 string임.
         * controllers에서 localTime으로 설정한 후, 여기서 UTC기준으로 전달함.
         * @param alarmInfo
         */
        obj._postPushInfo  = function postPushInfo(alarmInfo) {
            var self = this;
            var time = alarmInfo.time;
            var pushTime = time.getUTCHours() * 60 * 60 + time.getUTCMinutes() * 60;
            var pushInfo = { registrationId: self.pushData.registrationId,
                type: self.pushData.type,
                pushTime: pushTime,
                cityIndex: alarmInfo.cityIndex,
                town: alarmInfo.town,               //first, second, third
                name: alarmInfo.name,
                location: alarmInfo.location,       //lat, long
                source: alarmInfo.source,           //KMA or DSF, ...
                units: Units.getAllUnits()
            };
            //name, units
            $http({
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Accept-Language': Util.language, 'Device-Id': Util.uuid},
                url: self.pushUrl,
                data: pushInfo,
                timeout: 10*1000
            })
                .success(function (data) {
                    if (data) {
                        console.log(JSON.stringify(data));
                    }
                })
                .error(function (data, status) {
                    console.log(status +":"+data);
                    data = data || "Request failed";
                    var err = new Error(data);
                    err.code = status;
                    console.log(err);
                    //callback(err);
                });
        };

        obj._deletePushInfo = function deletePushInfo(alarmInfo) {
            var self = this;
            var pushInfo = { registrationId: self.pushData.registrationId,
                type: self.pushData.type,
                cityIndex: alarmInfo.cityIndex,
                town: alarmInfo.town };

            $http({
                method: 'DELETE',
                headers: {'Content-Type': 'application/json', 'Device-Id': Util.uuid},
                url: self.pushUrl,
                data: pushInfo,
                timeout: 10*1000
            })
                .success(function (data) {
                    if (data) {
                        console.log(JSON.stringify(data));
                    }
                })
                .error(function (data, status) {
                    console.log(status +":"+data);
                    data = data || "Request failed";
                    var err = new Error(data);
                    err.code = status;
                    console.log(err);
                    //callback(err);
                });
        };

        obj._updateRegistrationId = function updateRegistrationId( registrationId) {
            var self = this;
            //update registration id on server
            $http({
                method: 'PUT',
                headers: {'Content-Type': 'application/json', 'Device-Id': Util.uuid},
                url: self.pushUrl,
                data: {newRegId: registrationId, oldRegId: self.pushData.registrationId},
                timeout: 10*1000
            })
                .success(function (data) {
                    //callback(undefined, result.data);
                    console.log(data);
                })
                .error(function (data, status) {
                    console.log(status +":"+data);
                    data = data || "Request failed";
                    var err = new Error(data);
                    err.code = status;
                    console.log(err);
                    //callback(err);
                });
            self.pushData.registrationId = registrationId;
        };

        obj.register = function (callback) {
            var self = this;

            if (!window.PushNotification) {
                console.log("push notification plugin is not set");
                return;
            }

            window.push = PushNotification.init(self.config);

            window.push.on('registration', function(data) {
                console.log(JSON.stringify(data));
                if (self.pushData.registrationId != data.registrationId) {
                    self._updateRegistrationId(data.registrationId);
                }
                return callback(data.registrationId);
            });

            //android에서는 background->foreground 넘어올 때 event 발생하지 않음
            window.push.on('notification', function(data) {
                console.log('notification = '+JSON.stringify(data));
                // data.message,
                // data.title,
                // data.count,
                // data.sound,
                // data.image,
                // data.additionalData.foreground
                // data.additionalData.coldstart
                // data.additionalData.cityIndex
                if (data && data.additionalData && data.additionalData.foreground === false) {
                    //clicked 인지 아닌지 구분 필요.
                    //ios의 경우 badge 업데이트
                    //현재위치의 경우 데이타 업데이트 가능? 체크


                    //if have additionalData go to index page
                    var url = '/tab/forecast?fav='+data.additionalData.cityIndex;
                    //setCityIndex 와 url fav 까지 해야 이동됨 on ios
                    var fav = parseInt(data.additionalData.cityIndex);
                    if (!isNaN(fav)) {
                        if (fav === 0) {
                            var city = WeatherInfo.getCityOfIndex(0);
                            if (city !== null && !city.disable) {
                                WeatherInfo.setCityIndex(fav);
                            }
                        } else {
                            WeatherInfo.setCityIndex(fav);
                        }
                    }
                    console.log('clicked: ' + data.additionalData.cityIndex + ' url='+url);
                    $location.url(url);
                    Util.ga.trackEvent('action', 'click', 'push url='+url);
                }
                else {
                    Util.ga.trackEvent('action', 'error', 'push data='+data);
                }
            });

            window.push.on('error', function(e) {
                console.log('notification error='+e.message);
                Util.ga.trackEvent('plugin', 'error', 'push '+ e.message);
                // e.message
            });

            /**
             * WeatherInfo 와 circular dependency 제거용.
             * @param cityIndex
             * @param time
             * @param callback
             */
            window.push.updateAlarm = function (cityIndex, time, callback) {
                return self.updateAlarm(cityIndex, time, callback);
            };

            window.push.getAlarm = function (cityIndex) {
                return self.getAlarm(cityIndex);
            };
        };

        obj.unregister = function () {
            console.log('we do not use unregister');
            //var self = this;
            //console.log('push unregister');
            //window.push.unregister(function() {
            //    console.log('push unregister success');
            //    self.push = undefined;
            //}, function(e) {
            //    console.log('error push unregister');
            //    console.log(e);
            //});
        };

        /**
         * 중복 체크는 함수 호출 전에 체크 #181 #820 #1580 #1757
         * @param cityIndex
         * @param time
         * @param callback
         * @returns {*}
         */
        obj.updateAlarm = function (cityIndex, time, callback) {
            var self = this;
            var city = WeatherInfo.getCityOfIndex(cityIndex);
            var town;

            var params = {index:cityIndex, time: time};
            Util.ga.trackEvent('push', 'update', JSON.stringify(params));

            if (!callback) {
                callback = function (err) {
                    if (err) {
                        Util.ga.trackEvent('push', 'error', err);
                    }
                };
            }

            if (time == undefined) {
                return callback(new Error("You have to set time for add alarm"));
            }

            //이전 버전의 즐겨찾기에 저장된 지역이 location이 없는 경우 town 정보 사용
            if (!city.hasOwnProperty('location')) {
                town = WeatherUtil.getTownFromFullAddress(WeatherUtil.convertAddressArray(city.address));
            }

            var alarmInfo = {cityIndex: cityIndex, time: time, name: city.name, source: city.source};

            if (city.location) {
                alarmInfo.location = city.location;
            }

            if (town && !(town.first=="" && town.second=="" && town.third=="")) {
                alarmInfo.town = town;
            }

            if (!alarmInfo.hasOwnProperty('location') && !alarmInfo.hasOwnProperty('town')) {
                return callback(new Error("You have to set location info for add alarm"));
            }

            if (self.pushData.alarmList.length == 0) {
                self.pushData.alarmList.push(alarmInfo);
            }
            else {
                var i = self.pushData.alarmList.findIndex(function (obj) {
                    return obj.cityIndex === alarmInfo.cityIndex;
                });

                if (i < 0) {
                    self.pushData.alarmList.push(alarmInfo);
                }
                else {
                    self.pushData.alarmList[i] = alarmInfo;
                }
            }

            if (!window.push) {
                self.register(function () {
                    self._postPushInfo(alarmInfo);
                    self.savePushInfo();
                    return callback(undefined, alarmInfo);
                });
            }
            else {
                self._postPushInfo(alarmInfo);
                self.savePushInfo();
                return callback(undefined, alarmInfo);
            }
        };

        obj.removeAlarm = function (alarmInfo) {
            var self = this;
            console.log('remove alarm='+JSON.stringify(alarmInfo));
            for (var i=0; i<self.pushData.alarmList.length; i++) {
                var a = self.pushData.alarmList[i];
                if (a.cityIndex === alarmInfo.cityIndex) {
                    break;
                }
            }
            if (i == self.pushData.alarmList.length) {
                console.log('error fail to find alarm='+JSON.stringify(alarmInfo));
                return;
            }

            self.pushData.alarmList.splice(i, 1);
            self._deletePushInfo(alarmInfo);

            if (self.pushData.alarmList.length == 0) {
                self.unregister();
            }
            self.savePushInfo();
        };

        obj.getAlarm = function (cityIndex) {
            var self = this;
            for (var i=0; i<self.pushData.alarmList.length; i++) {
                var a = self.pushData.alarmList[i];
                if (a.cityIndex === cityIndex) {
                    return self.pushData.alarmList[i];
                }
            }
            console.log('fail to find cityIndex='+cityIndex);
        };

        obj.init = function () {
            var self = this;

            self.loadPushInfo();

            if (!window.PushNotification) {
                Util.ga.trackEvent('push', 'error', 'loadPlugin');
                return;
            }

            if (ionic.Platform.isIOS()) {
                self.pushData.type = 'ios';
            }
            else if (ionic.Platform.isAndroid()) {
                self.pushData.type = 'android';
            }

            //if push is on, call register
            if (self.pushData.alarmList.length > 0) {
                PushNotification.hasPermission(function(data) {
                    if (data.isEnabled) {
                        console.log('isEnabled');
                    }
                    else {
                        console.log('isEnabled is false');
                        //alert('you have to set notification permission');
                    }
                });

                if (window.push) {
                    console.log('Already set push notification');
                    return;
                }
                self.register(function (registrationId) {
                    console.log('start push registrationId='+registrationId);
                });
            }
        };

        return obj;
    });

