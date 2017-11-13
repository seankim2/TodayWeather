/**
 *
 * Created by aleckim on 2017. 11. 8..
 */

"use strict";

var async = require('async');
var request = require('request');

var config = require('../config/config');

var daumKeys = JSON.parse(config.keyString.daum_keys);
var googleApiKey = config.keyString.google_key;

function GeoController(lat, lon, lang, country) {
    this.lat = lat;
    this.lon = lon;
    this.lang = lang;
    this.country = country;
    this.kmaAddress = null;
    this.address = "";
    this.name = "";
}

GeoController.prototype._request = function(url, callback) {
    request(url, {json: true, timeout: 5000}, function(err, response, body) {
        if (err) {
            return callback(err);
        }
        if (response.statusCode >= 400) {
            err = new Error("url="+url+" statusCode="+response.statusCode);
            return callback(err);
        }
        callback(err, body);
    });
};

/**
 * {"type":"H","code":"1123064","name":"역삼1동","fullName":"서울특별시 강남구 역삼1동","regionId":"I10000901",
 * "name0":"대한민국","code1":"11","name1":"서울특별시","code2":"11230","name2":"강남구","code3":"1123064",
 * "name3":"역삼1동","x":127.03306535867272,"y":37.495359482762545}
 * {"type":"H","code":"90003","name":"일본","fullName":"일본","name0":"일본",
 * "x":135.2266257553163,"y":33.63189788608174}
 * @param callback
 * @private
 */
GeoController.prototype._getAddressFromDaum = function (callback) {
    var that = this;
    var index = 0;

    async.retry(daumKeys.length,
        function (cb) {
            var url = 'https://apis.daum.net/local/geo/coord2addr'+
                '?apikey=' + daumKeys[index] +
                '&longitude='+ that.lon +
                '&latitude='+that.lat+
                '&inputCoordSystem=WGS84'+
                '&output=json';
            index++;

            log.info(url);
            that._request(url, function (err, result) {
                if(err) {
                    return cb(err);
                }
                cb(null, result);
            });
        },
        function (err, result) {
            if (err) {
                return callback(err);
            }

            try {
                if (result.name0 === "대한민국") {
                    that.country = "KR";
                    that.kmaAddress = {"region": result.name1, "city": result.name2, "town": result.name3};
                    //if lang is not ko, get address from google api
                    if (!that.lang) {
                        that.lang = "ko";
                    }
                    if (that.lang === "ko") {
                        that.address = result.fullName;
                    }
                    that.country = "KR";
                    if (result.name3 && result.name3 != "") {
                        that.name = result.name3;
                    }
                    else if (result.name2 && result.name2 != "") {
                        that.name = result.name2;
                    }
                    else if (result.name1 && result.name1 != "") {
                        that.name = result.name1;
                    }
                    else if (result.name0 && result.name0 != "") {
                        that.name = result.name0;
                    }
                }
                else {
                    log.debug("It is not korea");
                }

            }
            catch (e) {
               return callback(e);
            }
            callback();
        });

    return this;
};

function _getAddressInfoFromGoogleResult(result) {
    var sub_level2_types = [ "political", "sublocality", "sublocality_level_2" ];
    var sub_level1_types = [ "political", "sublocality", "sublocality_level_1" ];
    var local_types = [ "locality", "political" ];
    var info = {};
    info.address = result.formatted_address;

    for (var j=0; j < result.address_components.length; j++) {
        var address_component = result.address_components[j];
        if ( address_component.types[0] == sub_level2_types[0]
            && address_component.types[1] == sub_level2_types[1]
            && address_component.types[2] == sub_level2_types[2] ) {
            info.sub_level2_name = address_component.short_name;
        }

        if ( address_component.types[0] == sub_level1_types[0]
            && address_component.types[1] == sub_level1_types[1]
            && address_component.types[2] == sub_level1_types[2] ) {
            info.sub_level1_name = address_component.short_name;
        }

        if ( address_component.types[0] == local_types[0]
            && address_component.types[1] == local_types[1] ) {
            info.local_name = address_component.short_name;
        }
    }
    return info;
}

GeoController.prototype._parseGoogleResult = function (data) {
    if (data.status !== "OK") {
        //'ZERO_RESULTS', 'OVER_QUERY_LIMIT', 'REQUEST_DENIED',  'INVALID_REQUEST', 'UNKNOWN_ERROR'
        throw new Error(data.status);
    }

    var sub_level2_types = [ "political", "sublocality", "sublocality_level_2" ];
    var sub_level1_types = [ "political", "sublocality", "sublocality_level_1" ];
    var local_types = [ "locality", "political" ];
    var country_types = ["country"];
    var country_name;
    var address_sublocality_level_2;
    var address_sublocality_level_1;
    var address_locality;
    var address;
    var name;

    for (var i=0; i < data.results.length; i++) {
        var result = data.results[i];

        //get country_name
        for (var j=0; j < result.address_components.length; j++) {
            if (country_name) {
                break;
            }
            var address_component = result.address_components[j];
            if ( address_component.types[0] == country_types[0] ) {
                if (address_component.short_name.length <= 2) {
                    country_name = address_component.short_name;
                }
            }
        }

        //postal_code
        switch (result.types.toString()) {
            case sub_level2_types.toString():
                if (!address_sublocality_level_2) {
                    address_sublocality_level_2 = _getAddressInfoFromGoogleResult(result);
                }
                break;
            case sub_level1_types.toString():
                if (!address_sublocality_level_1) {
                    address_sublocality_level_1 = _getAddressInfoFromGoogleResult(result);
                }
                break;
            case local_types.toString():
                if (!address_locality) {
                    address_locality = _getAddressInfoFromGoogleResult(result);
                }
                break;
            default:
                break;
        }
    }

    if (country_name == undefined) {
        throw new Error('country_name null');
    }

    if (address_sublocality_level_2) {
        address = address_sublocality_level_2.address;
        name = address_sublocality_level_2.sub_level2_name;
    }
    else if (address_sublocality_level_1) {
        address = address_sublocality_level_1.address;
        name = address_sublocality_level_1.sub_level1_name;
    }
    else if (address_locality) {
        address = address_locality.address;
        name = address_locality.local_name;
    }
    else {
        throw new Error('failToFindLocation');
    }

    if (name == undefined || address == undefined) {
        throw new Error('failToFindLocation');
    }

    var geoInfo =  {country: country_name, address: address};
    geoInfo.name = name;
    return geoInfo;
};

GeoController.prototype._getAddressFromGoogle = function (callback) {
    var that = this;
    //retry with key
    var url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + that.lat + "," + that.lon;
    if (that.lang) {
        url += "&language="+that.lang;
    }
    if (googleApiKey) {
        url += "&key="+googleApiKey;
    }
    else {
        log.warn("google api key is not valid");
    }
    log.info(url);
    async.retry(3,
        function (cb) {
            that._request(url, function (err, result) {
                if (err) {
                    return cb(err);
                }
                cb(null, result);
            });
        },
        function (err, result) {
            if (err) {
                return callback(err);
            }
            try {
               var geoInfo = that._parseGoogleResult(result);
                that.country = geoInfo.country;
                that.name = geoInfo.name;
                that.address = geoInfo.address;
            }
            catch(e) {
                return callback(e);
            }
            callback();
        });

    return this;
};

GeoController.prototype.setInfoFromReq = function (req) {
    var lat = req.params.lat;
    var lon = req.params.lon;
    var country = req.query.country;
    var address = req.query.address;
    var lang;

    var al = req.headers['accept-language'];
    if (al) {
        lang = al.split('-')[0];
    }
    if (country) {
        country = country.toUpperCase();
    }
    this.lat = lat;
    this.lon = lon;
    this.lang = lang;
    this.country = country;
    this.address = address;
    //set units
};

/**
 *
 * @param req
 * @param res
 * @param next
 * @returns {GeoController}
 */
GeoController.prototype.location2address = function(req, res, next) {
    var that = this;

    async.waterfall([
            function (callback) {
                if (that.country === undefined || that.country === 'KR') {
                    that._getAddressFromDaum(function (err) {
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            },
            function (callback) {
                if (that.lang !== 'ko' ||
                        that.country !== 'KR') {
                   that._getAddressFromGoogle(function (err) {
                       callback(err);
                   });
                }
                else {
                    callback();
                }
            }
        ],
        function (err) {
            if (err) {
                return next(err);
            }
            req.country = that.country;
            if (that.kmaAddress) {
                req.params.region = that.kmaAddress.region;
                req.params.city = that.kmaAddress.city;
                req.params.town = that.kmaAddress.town;
            }
            else {
                req.params.category = 'current';
                req.params.version = '010000';
                req.query.gcode = req.params.lat + ',' + req.params.lon;
            }

            req.result = req.result?req.result:{};
            req.result.location = {lat:req.params.lat, lon:req.params.lon};
            req.result.name = that.name;
            req.result.address = that.address;
            req.result.country = that.country;

            log.info(that);
            next();
        });

    return this;
};

module.exports = GeoController;
