/**
 * Created by aleckim on 15. 11. 4..
 */

"use strict";

var Logger = require('../lib/log');
global.log  = new Logger(__dirname + "/debug.log");

var assert  = require('assert');

var kecoController = require('../controllers/kecoController');

describe('unit test - keco controller', function() {
    //var mongoose = require('mongoose');
    //mongoose.connect('localhost/todayweather', function(err) {
    //    if (err) {
    //        console.error('Could not connect to MongoDB!');
    //        console.log(err);
    //    }
    //});
    //mongoose.connection.on('error', function(err) {
    //    console.error('MongoDB connection error: ' + err);
    //});

    global.__ = function (val) {
        return val;
    };

    it('test _convertDustFrcstRegion', function () {
        var controllerManager = require('../controllers/controllerManager');
        global.manager = new controllerManager();
        var siDo;
        siDo = kecoController._convertDustFrcstRegion('강원도','강릉시');
        assert.equal(siDo, '영동', '');
    });

    //it('test get dust forecast', function (done) {
    //    var dateList = ['20160331', '20160401', '20160402', '20160403', '20160404'];
    //   kecoController.getDustFrcst({region:'강원도', city:'강릉시'}, dateList, function (err, results) {
    //       if (err) {
    //           console.log(err);
    //       }
    //       console.log(results);
    //       done();
    //   });
    //});

    //it('test get arpltn info', function (done) {
    //    var town = { "first" : "경기도", "second" : "성남시분당구", "third" : "수내1동"};
    //    kecoController.getArpLtnInfo(town, new Date(), function (err, arpltn) {
    //        if (err) {
    //            log.error (err);
    //        }
    //        console.log(JSON.stringify(arpltn));
    //        done();
    //    });
    //});

    //it('test appendData', function(done) {
    //    this.timeout(4*1000);
    //    var town = { "first" : "경기도", "second" : "안성시", "third" : "안성3동"};
    //    var current = {};
    //
    //    kecoController.appendData(town, current, function (err, result) {
    //        if (err) {
    //            console.log(err + ' ' + result);
    //        }
    //        //console.log(current);
    //        done();
    //    });
    //});

    //it('test again to get appendData', function(done) {
    //    this.timeout(10*1000);
    //    var town = { "first" : "경기도", "second" : "안성시", "third" : "안성3동"};
    //    var current = {};
    //
    //    kecoController.appendData(town, current, function (err, result) {
    //        console.log(err + ' ' + result);
    //        console.log(current);
    //        done();
    //    });
    //});

    it('test getting aqi grade', function(done){
        var testData = {
            pm10Value: 55,
            pm25Value: 65,
            o3Value: 0.02,
            no2Value: 0.10,
            coValue: 7,
            so2Value: 0.08,
            khaiValue: 100
        };

        kecoController.recalculateValue(testData, 'airkorea');
        log.info('airkorea : ', testData);
        kecoController.recalculateValue(testData, 'airkorea_who');
        log.info('airkorea_who : ', testData);
        kecoController.recalculateValue(testData, 'airnow');
        log.info('airnow : ', testData);
        kecoController.recalculateValue(testData, 'aqicn');
        log.info('aqicn : ', testData);
        done();
    });

    it('test getting aqi grade', function(){
        var testData = { "stationName" : "상대원동", "pm25Grade" : -1, "pm10Grade" : 2,
                        "no2Grade" : 3, "o3Grade" : 1, "coGrade" : 1, "so2Grade" : 1,
                        "khaiGrade" : -1, "khaiValue" : -1, "pm25Value" : 80,
                        "pm10Value" : 80, "no2Value" : 0.064, "o3Value" : 0.003,
                        "coValue" : 0.9, "so2Value" : 0.005, "dataTime" : "2017-12-22 20:00" };

        kecoController.recalculateValue(testData, 'airkorea');
        assert.equal(testData.pm25Grade, 3);
        assert.equal(testData.khaiGrade, undefined);
        log.info('airkorea : ', testData);
    });
});


