using Toybox.ActivityMonitor;
using Toybox.Application;
using Toybox.Background;
using Toybox.Communications;
using Toybox.SensorHistory;
using Toybox.System;
using Toybox.Time;

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

    function history(methodName) {
        var options = {
            :period => new Time.Duration(30 * 60),
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

    function latest(rows) {
        if (rows == null || rows.size() == 0) {
            return null;
        }
        return rows[rows.size() - 1][1];
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
        var stress = history("stress");
        var battery = history("body_battery");
        var info = ActivityMonitor.getInfo();

        var currentStress = latest(stress);
        var respiration = null;
        var steps = null;

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
                "heartRate" => latest(hr),
                "stress" => currentStress,
                "bodyBattery" => latest(battery),
                "respiration" => respiration
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

    function onResponse(responseCode, data) {
        Background.exit({
            "ok" => responseCode >= 200 && responseCode < 300,
            "responseCode" => responseCode
        });
    }
}
