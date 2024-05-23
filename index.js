const functions = require("firebase-functions");

// // Create and deploy your first functions
// // https://firebase.google.com/docs/functions/get-started
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


const http = require("http");
const https = require("https");
const jsdom = require("jsdom");
const jquery = require("jquery");
const xml2js = require("xml2js");
const url = require('url');
const port = process.env.PORT || 8000;

const timezone = 'Asia/Tokyo';
process.env.TZ = timezone;

let weatherInfo = {};
let weathers = [];
let news = [];
let btcjpy = 0;
let btcjpyLastUpdated = undefined;
let regionCode = undefined;
let isHttps = false;

const getBitcoinRatePromise = _ => new Promise((resolve, reject) => {
	https.get("https://coincheck.com/api/ticker", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				btcjpy = parseFloat(json["last"]);
				btcjpyLastUpdated = new Date(json["timestamp"] * 1000);
				resolve();
			} catch (error) {
				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getWeatherPromise = _ => new Promise((resolve, reject) => {
	if (regionCode == undefined) {
		regionCode = 130000;
	}
	https.get("https://www.jma.go.jp/bosai/forecast/data/forecast/" + regionCode + ".json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				weatherInfo = {
					region: json[1]["timeSeries"][1]["areas"][0]["area"]["name"],
					date: json[0]["reportDatetime"]
				};
				weathers = [];
				for (let i = 0; i < json[0]["timeSeries"][0]["timeDefines"].length; i++) {
					let weather = {
						date: json[0]["timeSeries"][0]["timeDefines"][i],
						name: json[0]["timeSeries"][0]["areas"][0]["weathers"][i],
						temperature: "--"
					};
					let dateDefined = new Date(json[0]["timeSeries"][0]["timeDefines"][i]);
					for (let j = 0; j < json[1]["timeSeries"][0]["timeDefines"].length; j++) {
						let dateCurrent = new Date(json[1]["timeSeries"][0]["timeDefines"][j]);
						if (dateDefined.getYear() === dateCurrent.getYear() && dateDefined.getMonth() === dateCurrent.getMonth() && dateDefined.getDate() === dateCurrent.getDate()) {
							if (json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] === ''
								|| json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] === '') {
								 continue;
							}
							weather.temperature = json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] + "℃ / " + json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] + "℃";
							break;
						}
					}
					weathers.push(weather);
				}
				if (json[0]["timeSeries"][2]["areas"][0]["temps"].length >= 4) {
					weathers[0].temperature = "-- / " + json[0]["timeSeries"][2]["areas"][0]["temps"][1] + "℃";
					weathers[1].temperature = json[0]["timeSeries"][2]["areas"][0]["temps"][2] + "℃ / " + json[0]["timeSeries"][2]["areas"][0]["temps"][3] + "℃";
				} else {
					weathers[1].temperature = json[0]["timeSeries"][2]["areas"][0]["temps"][0] + "℃ / " + json[0]["timeSeries"][2]["areas"][0]["temps"][1] + "℃";
				}
				resolve();
			} catch (error) {
				regionCode = undefined;

				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getWarningPromise = _ => new Promise((resolve, reject) => {
	https.get("https://www.jma.go.jp/bosai/warning/data/warning/" + regionCode + ".json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				warning = json.headlineText;
				resolve();
			} catch (error) {
				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getNewsPromise = _ => new Promise((resolve, reject) => {
	https.get("https://news.yahoo.co.jp/rss/topics/top-picks.xml", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			xml2js.parseString(body, (error, result) => {
				if (error) {
					console.error(error);
					reject(error);
				} else {
					news = [];
					for (let i = 0; i < result['rss']['channel'][0]['item'].length; i++) {
						let item = {
							date: result['rss']['channel'][0]['item'][i]['pubDate'],
							title: result['rss']['channel'][0]['item'][i]['title']
						};
						news.push(item);
					}
					resolve();
				}
			});
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const dateLabels = ['日', '月', '火', '水', '木', '金', '土'];

function kanaFullToHalf(str){
    let kanaMap = {
        "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
        "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
        "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
        "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
        "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
        "ヴ": "ｳﾞ", "ヷ": "ﾜﾞ", "ヺ": "ｦﾞ",
        "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
        "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
        "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
        "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
        "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
        "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
        "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
        "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
        "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
        "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
        "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
        "ッ": "ｯ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ",
        "。": "｡", "、": "､", "ー": "ｰ", "「": "｢", "」": "｣", "・": "･",
        "　": " "
    };
    let reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
    return str.replace(reg, function(s){
        return kanaMap[s];
    }).replace(/゛/g, 'ﾞ').replace(/゜/g, 'ﾟ');
}

function toHalfWidth(str) {
	str = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
	  return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
	});
	return str;
  }

function getDefaultContent() {
	let today = new Date();
	let firstDay = new Date(today.getYear(), today.getMonth(), 1);
	let todayJST = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));

	let content = `
<head>
<meta charset="UTF-8">
<title>Dumb Portal k</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimin-scale=0.1, user-scalable=yes">
<style>td{padding:0;}</style>
</head>
<body style="background:#ff9; position: relative; min-width: 256px; text-align: left;">
<div id="content" style="width:256px; margin: auto; background:#cff; text-align: left;">
<div id="time" style="background: #444; color: #fff; text-align: center;"></div>
<br>
<table style="width: 100%">
<tr><th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th></tr>
${[0,1,2,3,4,5].map(row => "<tr>" + [0,1,2,3,4,5,6].map(col => {var d = (row * 7 + col - 1 - (firstDay.getDay())); var date = new Date(today.getYear(), today.getMonth(), d); return "<td style='text-align: center; " + (d == today.getDate() ? "font-weight: bold;" : "") + "'>" + (date.getMonth() == today.getMonth() ? d : '') +"</td>";}).join('') + '</tr>').join('')}
</table>
<br>
<hr>
<h4>ﾆｭｰｽ</h4>
${news.map(n => "<span>" + kanaFullToHalf(toHalfWidth(n.title.toString())) + "</span><br>").join('')}
<br>
<hr>
<h4>天気</h4>
${weathers.map(w => "<span><strong>" + ((new Date(w.date)).getMonth() + 1) + "/" + (new Date(w.date)).getDate() + "(" + dateLabels[(new Date(w.date)).getDay()] + ")" + "</strong> <span style='white-space: nowrap; text-overflow: ellipsis;'>" + kanaFullToHalf(toHalfWidth(w.name.replaceAll('　',' '))) + " " + w.temperature + "</span></span><br>").join('')}
<br><span>${kanaFullToHalf(toHalfWidth(warning))}</span>
<br><br>
<div style="background: #444; color: white; text-align: center; font-size: small;">Powered by <a href="https://www.jma.go.jp/jma/index.html" target="_blank" style="color: white;">Japan Meteorological Agency</a> & <a href="https://news.yahoo.co.jp/" target="_blank" style="color: white;">Yahoo! News</a></div>
</td>
</div>
<script>
var dateLabels=['日','月','火','水','木','金','土'];function printTime(){setTimeout(printTime, 1000); var date = new Date(); document.getElementById('time').innerText=''+(date.getFullYear())+'/'+('00'+(date.getMonth()+1)).slice(-2)+'/'+('00'+(date.getDate())).slice(-2)+'('+dateLabels[date.getDay()]+')'+' '+date.getHours()+':'+('00'+date.getMinutes()).slice(-2)+':'+('00'+date.getSeconds()).slice(-2);}printTime();
</script>
</body>
	`;

	return content;
}

exports.main = functions.https.onRequest((request, response) => {
	isHttps = request.url.indexOf("https://") == 0;

	let parsedUrl = url.parse(request.url, true);
	if (parsedUrl.query.region != undefined) {
		regionCode = parsedUrl.query.region;
	}

	const allPromise = Promise.all([getWeatherPromise(), getNewsPromise(), getWarningPromise()]).then(_ => {
		let content = getDefaultContent();

	    response.send(content);
	    // console.log(`Sent a response : ${content}`);
	}).catch(error => {
		response.send(error.message);
	});
	return;
});


const server = http.createServer((request, response) => {
	isHttps = request.url.indexOf("https://") == 0;

	let parsedUrl = url.parse(request.url, true);
	if (parsedUrl.query.region != undefined) {
		regionCode = parsedUrl.query.region;
	}

	if (parsedUrl.pathname == '/') {
		const allPromise = Promise.all([getWeatherPromise(), getNewsPromise(), getWarningPromise()]).then(_ => {
			response.writeHead(200, {
				"Content-Type": "text/html"
			});

			let content = getDefaultContent();

		    response.end(content);
		    // console.log(`Sent a response : ${content}`);
		}).catch(error => {
			response.writeHead(500, {
				"Content-Type": "text/html"
			});
			response.end(error.message);
		});
		return;
	}

	response.writeHead(404);
	response.end();
	return;
});

server.listen(port);
console.log("Server started on port " + port);

