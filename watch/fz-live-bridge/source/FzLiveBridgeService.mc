using Toybox.ActivityMonitor;
using Toybox.Application;
using Toybox.Background;
using Toybox.Communications;
using Toybox.Complications;
using Toybox.SensorHistory;
using Toybox.System;
using Toybox.Time;
import Toybox.Lang;
import Toybox.PersistedContent;

(:background)
class FzLiveBridgeService extends System.ServiceDelegate {
    function initialize() {
        System.ServiceDelegate.initialize();
    }

    function collect(iterator, limit) {
        var rows = [];
        if (iterator == null) {
            return rows;
        }

        var sample = iterator.next();
        while (sample != null && rows.size() < limit) {
            if (sample.data != null && sample.when != null) {
                rows.add([sample.when.value(), sample.data]);
            }
            sample = iterator.next();
        }
        return rows;
    }

    function collectActivityHeartRate(iterator, limit) {
        var rows = [];

        if (iterator == null) {
            return rows;
        }

        var sample = iterator.next();

        while (sample != null && rows.size() < limit) {
            if (sample.when != null &&
                sample.heartRate != ActivityMonitor.INVALID_HR_SAMPLE) {
                rows.add([sample.when.value(), sample.heartRate]);
            }

            sample = iterator.next();
        }

        return rows;
    }

    function history(methodName) {
        var options = {
            :period => 40,
            :order => SensorHistory.ORDER_OLDEST_FIRST
        };

        try {
            if (methodName == "heart_rate" && (Toybox.SensorHistory has :getHeartRateHistory)) {
                return collect(SensorHistory.getHeartRateHistory(options), 40);
            }
            if (methodName == "stress" && (Toybox.SensorHistory has :getStressHistory)) {
                return collect(SensorHistory.getStressHistory(options), 40);
            }
            if (methodName == "body_battery" && (Toybox.SensorHistory has :getBodyBatteryHistory)) {
                return collect(SensorHistory.getBodyBatteryHistory(options), 40);
            }
        } catch (e) {
            System.println("FZ history " + methodName + ": " + e.getErrorMessage());
        }
        return [];
    }

    function complicationValue(complicationType) {
        try {
            if (!(Toybox has :Complications) || !(Toybox.Complications has :getComplication)) {
                return null;
            }

            var item = Complications.getComplication(new Complications.Id(complicationType));
            if (item != null && item.value != null) {
                return item.value;
            }
        } catch (e) {
            System.println("FZ complication " + complicationType + ": " + e.getErrorMessage());
        }
        return null;
    }

    function latest(rows) {
        if (rows == null || rows.size() == 0) {
            return null;
        }
        return rows[rows.size() - 1][1];
    }

    function appendCurrent(rows, observedAt, value) {
        if (value == null) {
            return;
        }

        if (rows.size() == 0 || rows[rows.size() - 1][0] != observedAt) {
            rows.add([observedAt, value]);
        }
    }

    function onTemporalEvent() {
        var endpoint = Application.Properties.getValue("fzEndpoint");
        var token = Application.Properties.getValue("fzToken");

        if (endpoint == null || token == null || endpoint.toString().length() == 0 || token.toString().length() == 0) {
            Background.exit({ "ok" => false, "reason" => "not_configured" });
            return;
        }

        var observedAt = Time.now().value();
        var hr = history("heart_rate");

        if (hr.size() == 0 && (Toybox.ActivityMonitor has :getHeartRateHistory)) {
            try {
                hr = collectActivityHeartRate(
                    ActivityMonitor.getHeartRateHistory(40, false),
                    40
                );
            } catch (e) {
                System.println("FZ activity HR fallback: " + e.getErrorMessage());
            }
        }

        var stress = history("stress");
        var battery = history("body_battery");
        var info = ActivityMonitor.getInfo();

        var currentHeartRate = latest(hr);
        var currentStress = latest(stress);
        var currentBodyBattery = latest(battery);
        var respiration = null;
        var steps = null;
        var sleepScore = null;

        if (info != null) {
            if (info has :stressScore && info.stressScore != null) {
                currentStress = info.stressScore;
            }
            if (info has :respirationRate && info.respirationRate != null) {
                respiration = info.respirationRate;
            }
            if (info has :steps && info.steps != null) {
                steps = info.steps;
            }
        }

        if (currentHeartRate == null && (Toybox.Complications has :COMPLICATION_TYPE_HEART_RATE)) {
            currentHeartRate = complicationValue(Complications.COMPLICATION_TYPE_HEART_RATE);
        }
        if (currentStress == null && (Toybox.Complications has :COMPLICATION_TYPE_STRESS)) {
            currentStress = complicationValue(Complications.COMPLICATION_TYPE_STRESS);
        }
        if (currentBodyBattery == null && (Toybox.Complications has :COMPLICATION_TYPE_BODY_BATTERY)) {
            currentBodyBattery = complicationValue(Complications.COMPLICATION_TYPE_BODY_BATTERY);
        }
        if (respiration == null && (Toybox.Complications has :COMPLICATION_TYPE_RESPIRATION_RATE)) {
            respiration = complicationValue(Complications.COMPLICATION_TYPE_RESPIRATION_RATE);
        }
        if (Toybox.Complications has :COMPLICATION_TYPE_SLEEP_SCORE) {
            sleepScore = complicationValue(Complications.COMPLICATION_TYPE_SLEEP_SCORE);
        }

        appendCurrent(hr, observedAt, currentHeartRate);
        appendCurrent(stress, observedAt, currentStress);
        appendCurrent(battery, observedAt, currentBodyBattery);

        var respirationSeries = [];
        if (respiration != null) {
            respirationSeries.add([observedAt, respiration]);
        }

        var payload = {
            "schemaVersion" => "1.0",
            "observedAt" => observedAt,
            "device" => { "family" => "fenix8", "transport" => "connect-iq" },
            "current" => {
                "steps" => steps,
                "heartRate" => currentHeartRate,
                "stress" => currentStress,
                "bodyBattery" => currentBodyBattery,
                "respiration" => respiration,
                "sleepScore" => sleepScore
            },
            "series" => {
                "heart_rate" => hr,
                "stress" => stress,
                "body_battery" => battery,
                "respiration" => respirationSeries
            }
        };

        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {
                "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON,
                "Authorization" => "Bearer " + token.toString()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };

        try {
            Communications.makeWebRequest(endpoint.toString(), payload, options, method(:onResponse));
        } catch (e) {
            System.println("FZ web request: " + e.getErrorMessage());
            Background.exit({ "ok" => false, "reason" => "request_exception" });
        }
    }

    function onResponse(responseCode as Lang.Number, data as Null or Lang.Dictionary or Lang.String or PersistedContent.Iterator) as Void {
        Background.exit({
            "ok" => responseCode >= 200 && responseCode < 300,
            "responseCode" => responseCode
        });
    }
}
