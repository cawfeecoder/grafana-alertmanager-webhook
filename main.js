var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var axios = require('axios');

function postToAlertManager(alert){
    return axios.post('http://10.0.0.34:9093/api/v1/alerts', alert);
}

function interpolate(string, label_name, value){
    var regex = new RegExp("{{[$]labels[.]" + label_name + "}}", "g")
    return string.replace(regex, value);
}

function find_interpolations(string){
    var regex = /{{[$]labels[.](\w+)}}/gm;
    var extract_match_labels = /[.](\w+)}}/;
    var matches = string.match(regex);
    for (var match in matches) {
	matches[match] = matches[match].match(extract_match_labels)[1]
    }
    return matches;
}

app.use(bodyParser.json());

app.set('port', 8888);

app.post('/alert', function (req, res) {
	var alert = req.body;
	try {
		parsed = JSON.parse(alert.message);
		alert.message = parsed;
	} catch (e) {
                console.log("Didn't get a json body");
	}
	var transformed_alerts = []
	for (var index in alert.evalMatches) {
	    var instance = alert.evalMatches[index];
	    delete instance.tags['__name__'];
            var transformed_alert = {
                 "status": "firing",
	         "labels": {
		    "alertname": alert.message.alert || "",
	         },
		 "annotations": {
			 "graph": alert.imageUrl,

		 },
		 "geneartorURL": alert.ruleUrl, 
	    };
	    for (var label in instance.tags) {
	        transformed_alert.labels[label] = instance.tags[label];
	    }
	    for (var label in alert.message.labels) {
		transformed_alert.labels[label] = alert.message.labels[label];
	    }
	    for (var annotation in alert.message.annotations) {
		var interpolations = find_interpolations(alert.message.annotations[annotation]);
		transformed_alert.annotations[annotation] = alert.message.annotations[annotation];
		for (var interpolation in interpolations) {
		    transformed_alert.annotations[annotation] = interpolate(transformed_alert.annotations[annotation], interpolations[interpolation], instance.tags[interpolations[interpolation]])
		}
		console.log(transformed_alert);
	    }
	    transformed_alerts.push(transformed_alert);
	};
	return postToAlertManager(transformed_alerts).then(function (success) { res.send(200); }).catch(function (error) { res.send(500) });
});

var server = app.listen(app.get('port'), function() {
	console.log('Listening on port %d', server.address().port);
});
