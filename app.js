const request = require('request');
const cheerio = require('cheerio');
const async = require('async');
const fs = require('fs');
const path = require('path');
const randomUa = require('modern-random-ua')

function createIp() {
    let a = Math.round(Math.random() * 250) + 1,
        b = Math.round(Math.random() * 250) + 1,
    	c = Math.round(Math.random() * 240) + 1,
    	d = Math.round(Math.random() * 240) + 1;
    return [a, b, c, d].join('.');
}

// 爬取单个页面链接
function fetchPage(url) {
	return new Promise((resolve, reject) => {
		request.get({
			url,
			encoding: 'utf-8',
			// json: true,
			headers: {
				// ‘content-type’: ‘application/json’,
				// 'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': randomUa.generate(), // 'request'
				'X-Forwarded-For': createIp(),
			},
		}, (err, res, body) => {
			if (err) {
				reject(err);
			} else {
				resolve(body);
			}
		});
	});
}

// 并发爬取多个页面链接 async版本
function fetchPages(pageUrls, asyncNum) {
	return new Promise((resolve, reject) => {
		async.mapLimit(pageUrls, asyncNum, async url => {
			let result = await fetchPage(url);
			console.log(url + ' done');
			return result;
		}, (err, pages) => {
			if (err) {
				reject(err);
			} else {
				resolve(pages);
			}
		});
	});
}

// 并发爬取多个页面链接 Promise.all版本
async function fetchPagesPromise(pageUrls, number) {
    let start = 0;
    let len = Math.ceil(pageUrls.length / number);
    let pages = [];
    for (let i = 0; i < len; i++) {
        let end = start + number;
        let curPageUrls = pageUrls.slice(start, end);
        start = end;
        let res = await Promise.all(curPageUrls.map((url) => {
            return fetchPage(url);
        }));
        pages = pages.concat(res);
    }
    return pages;
}

// 正则匹配内容
function matchImg(content) {
    let imgs = [];
    let matchImgOriginRe = /<img.*?data-original="(.*?)"/g;

    content.replace(matchImgOriginRe, ($0, $1) => imgs.push($1));

    return [ ...new Set(imgs) ];
}

// 处理爬取的页面数据
function getData(pages) {
	return new Promise((resolve, reject) => {
		let imgData = [];
		pages.forEach(page => {
			let $ = cheerio.load(page);
			let imgArr = $('.postlist').find('li').find('img');
			imgArr.each(function() {
				let url = $(this).attr('data-original');
				let name = $(this).attr('alt');
				imgData.push({
					url,
					name
				});
			});
		});
		async.mapLimit(imgData, 5, async data => {
			await download(data.url, path.basename(data.url));
			console.log(data.name + ' done');
		}, (err, res) => {
			if (err) {
				reject(err);
			} else {
				resolve(res);
			}
		});
	})
}

// 下载资源
function download(uri, filename) {
	return new Promise((resolve, reject) => {
		request.head(uri, (err, res, body) => {
			if (err) {
				reject(err);
			} else {
				request.get({
					url: uri,
					rejectUnauthorized: false,
					headers: {
						'Referer': 'http://www.mzitu.com',
						'User-Agent': randomUa.generate(),
						'X-Forwarded-For': createIp(),
					},
				}).pipe(fs.createWriteStream('data/' + filename)).on('close', resolve);
			}
		});
	});
}

// 程序主入口
async function main() {
	let baseUrl = 'http://www.mzitu.com/xinggan/page/';
	let pageSize = 2;
	let pageUrls = [];
	for (let i = 0; i < pageSize; i++) {
		pageUrls.push(`${baseUrl}${i + 1}`);
	}

	let pages = await fetchPages(pageUrls, 5);
	await getData(pages);
	console.log('done');
}

main();