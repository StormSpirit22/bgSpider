const rp = require('request-promise')
const superagent = require('superagent');
const cheerio = require("cheerio");
const fs = require('fs-extra');
const XLSX = require('xlsx');
var Agent = require('socks5-http-client/lib/Agent');
const async = require("async");
const request = require('request');

const startPage = 1469;
const endPage = 1685;

let url = "http://blockgeek.org/t/topic/";
let urlsArray = [];

for(let i = startPage; i < endPage; i++) {
    let tempurl = url;
    urlsArray.push(tempurl + i);
}

process.env.NODE_NO_HTTP2=1
// console.log(urlsArray)

const type = {
    ARTICLE: 'Article',
    QUESTION: 'Question',
    REPLY: 'Reply',
}

let bgPosts = [];
// let userNames = new Set();

let usersPosts = new Map();
let postsForums = new Map();
// async function getData(startTime, endTime) {

//     //所有满足条件的帖子
    
// }
// let dateFlag = false;

function sleep() {
    return new Promise(resolve => setTimeout(resolve, 10000))
}

async function readFile() {

    const _headers = ['name', 'articles', 'questions', 'replys', 'rewards']
    let _data = [];
    for (var [key, value] of usersPosts) {
        // console.log("value", value);
        let user = {};
        user.name = value.name;
        user.articles = value.articles;
        user.questions = value.questions;
        user.replys = value.replys;
        user.rewards = 0;
        _data.push(user)
    }
    console.log(_data)

    var headers = _headers
                .map((v, i) => Object.assign({}, {v: v, position: String.fromCharCode(65+i) + 1 }))
                .reduce((prev, next) => Object.assign({}, prev, {[next.position]: {v: next.v}}), {});
                var data = _data
                .map((v, i) => _headers.map((k, j) => Object.assign({}, { v: v[k], position: String.fromCharCode(65+j) + (i+2) })))
                .reduce((prev, next) => prev.concat(next))
                .reduce((prev, next) => Object.assign({}, prev, {[next.position]: {v: next.v}}), {});
                    // 合并 headers 和 data
                    var output = Object.assign({}, headers, data);
                    // 获取所有单元格的位置
                    var outputPos = Object.keys(output);
                    // 计算出范围
                    var ref = outputPos[0] + ':' + outputPos[outputPos.length - 1];
                    // 构建 workbook 对象
                    var wb = {
                        SheetNames: ['mySheet'],
                        Sheets: {
                            'mySheet': Object.assign({}, output, { '!ref': ref })
                        }
                    };
                    // 导出 Excel
                XLSX.writeFile(wb, 'output.xlsx');
    
}

function writeExcel() {
    const _headers1 = ['名字', '发表文章数目', '回答问题数目', '提问数目', '奖励总数']
    const _headers2 = ['名字', '帖子链接', '时间', '帖子类别', '版块']
}

let startDate = new Date("2018-11-16");
let endDate = new Date("2018-11-24");
console.log(startDate, endDate)
let join = require('path').join;
let path = './data/posts/';

function getTitle(url) {
    console.log(url);
    return new Promise(function(resolve, reject){
        superagent.get(url).end(function(err, res){
            if(err) {
                console.log("ERROR superagent get url error")
                resolve("ERROR");
                return;
            }
            if(res.text) {
                console.log("success!")
            }
            else {
                console.log("failed!", res)
            }
            var $ = cheerio.load(res.text);
            console.log("title", $("title").text());
            let title = $("title").text();
            let index1 = title.indexOf("-");
            let index2 = title.indexOf("-", index1 + 1);
            let forum = title.substr(index1 + 2, index2 - index1 - 3);
            request(url+".json", function (error, response, body) {
                console.log('ERROR:', error); // Print the error if one occurred
                console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                // console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
                let result = JSON.parse(body);
                let posts = result.post_stream.posts;
                let postType = "";
                let i = 0;
                let usersInPost = new Set();
                for(let value of posts){
                    // console.log("value.name", value.name)
                    let post = {};
                    if(i == 0) {
                        let author = {};
                        author.name = value.name;                     //名字        
                        author.username = value.username;             //用户名
    
                        post.created_at = value.created_at;         //创建时间
                        // post.cooked = posts[i].cooked;                 //帖子内容
                        post.link = url + "/1";
                        post.forum = forum;
                        post.title = title;
                        
                        let createDate = new Date(post.created_at);
                        console.log("createDate", createDate);
                        if(createDate < startDate || createDate > endDate) {
                            reject("Out of date");
                        }
                        
                        // console.log("length", author.cooked.toString().length);
                        let str = value.cooked.toString();
                        let countChinese = 0;
                        for(let j = 0; j < str.length; j++) {
                            let ch = str.charCodeAt(j);
                            if(ch > 255)countChinese++;
                        }
                        // console.log("countChinese", countChinese);
                        if(countChinese >= 500) {
                            post.type = type.ARTICLE;
                            postType = type.ARTICLE;
                        }
                        else {
                            post.type = type.QUESTION;
                            postType = type.QUESTION;
                        }
                        // console.log("author.name", author.name)
                        if(!usersPosts.has(author.name)) {
                            if(post.type === type.ARTICLE) {
                                author.articles = 1;
                            }
                            else author.questions = 1;
                            author.posts = [];
                            author.posts.push(post);
                        }
                        else {
                            author = usersPosts.get(author.name);
                            if(post.type === type.ARTICLE) {
                                author.articles += 1;
                            }
                            else {
                                author.questions += 1;
                            }
                            author.posts.push(post);
                        }
                        
                        usersPosts.set(author.name, author);
                        usersInPost.add(author.name)
                    }
                    else if(postType === type.QUESTION) {
                        // console.log("question", posts[i].name)
                        let author = {};
                        
                        //如果该帖子回复用户中没有该用户才计入统计
                       
                        if(!usersInPost.has(value.name)) {
                            author.name = value.name;                     //名字        
                            author.username = value.username;             //用户名

                            post.created_at = value.created_at;         //创建时间
                            // post.cooked = value.cooked;                 //帖子内容
                            let index = i + 1;
                            post.link = url + "/" + index.toString();               
                            post.forum = forum;
                            post.title = title;

                            if(!usersPosts.has(author.name)) {
                                author.replys = 1;
                                author.posts = [];
                                author.posts.push(post);
                            }
                            else {
                                author = usersPosts.get(author.name);
                                if(author.replys != undefined)author.replys += 1;
                                else author.replys = 1;
                                author.posts.push(post);
                            }
                            usersPosts.set(author.name, author);
                            usersInPost.add(author.name);
                            // console.log("==========usersPosts", JSON.stringify(usersPosts.get(author.name)))
                                
                        }
                    }
                    else {
                        break;
                    }
                    // fs.writeFileSync("./usersPosts.txt", JSON.stringify(usersPosts))
                    i ++;
                }
                resolve("success")
            });
            // rp(options).then(function(result) {
            //     console.log("found result")
                
            // })
            // .catch((error => {
            //     console.log("**********POST ERROR*********", error)
            //     resolve("error");
            // }))
            // if(dateFlag) {

            //     reject(dateFlag);
            //     // break;
            // }
        })
    });
}

// let promises =  [];

// for(let i = 0; i < 3; i++) {
//     let k = 0;
//     promises[i] = [];
//     for(let j = 0; j < urlsArray.length; j++) {
//         promises[i][j] = getTitle(urlsArray[k]);
//         k++;
//         if(j == 4)break;
//     }
//     // promises2.push(getPosts(urlsArray[i]))
// }

function getJson(url) {
    return new Promise(function(resolve, reject){
        if(!postsForums.has(url.substr(url.length - 4, url.length))) {
            resolve("Not in valid forum");
            return;
        }
        request(url+".json", function (error, response, body) {
            console.log('ERROR:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            // console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
            if(!error && response.statusCode == 200) {
                let result = JSON.parse(body);
                let posts = result.post_stream.posts;
                fs.writeFileSync('./data/posts/' + url.substr(url.length - 4, url.length) + '.txt', JSON.stringify(posts));
                resolve("Success")
            }
            resolve("Error")
        });
    })
}

function getForum(url) {
    return new Promise(function(resolve, reject){
        console.log("url", url)
        superagent.get(url).end(function(err, res){
            if(err) {
                // console.log("ERROR superagent get url error")
                resolve("superagent get url error");
                // return;
            }
            var $ = cheerio.load(res.text);
            console.log("title", $("title").text());
            let title = $("title").text();
            let index1 = title.indexOf(" - ");
            let index2 = title.indexOf(" - ", index1 + 1);
            // console.log("index1index2", index1, index2)
            let forum = title.substr(index1 + 3, index2 - index1 - 3);
            fs.appendFileSync('./data/forum.txt', url + "|" +forum + "\n");
            if(forum === "ETH" || forum === "EOS" || forum === "BTC" || forum === "HPB" || forum === "DAG" || forum === "IPFS" || forum === "Other") {
                postsForums.set(url.substr(url.length - 4, url.length), forum);
            }
            resolve(forum);
        })
    })
}


async function getResult() {
    let files = fs.readdirSync(path);
    for(let filename of files) {
        let fPath = join(path, filename);
        let stats=fs.statSync(fPath);
        if(stats.isFile()) {
            let posts = fs.readJsonSync(fPath);
            // console.log(posts);
            let result = await calculatePosts(posts,filename);
            console.log("result",result)
            if(result === "OutOfDate") {
                // for (var [key, value] of usersPosts) {
                //     console.log("value", value);
                //     // for(let v of value.posts) {
                //     //     console.log("post", v)
                //     // }
                // }
                return;
            }
        }
    }
    // for (var [key, value] of usersPosts) {
    //     console.log("value", value);
    //     // for(let v of value.posts) {
    //     //     console.log("post", v)
    //     // }
    // }
}

async function getBatchForum(url) {
    for(let i = 0; i < urlsArray.length; i++) {
        let result = await getForum(urlsArray[i]);
        // console.log("forum result", result)
    }
}

async function getBatchJson(url) {
    for(let i = 0; i < urlsArray.length; i++) {
        let result = await getJson(urlsArray[i]);
        console.log("json result", result)
    }
}

function calculatePosts(posts, filename) {
    // console.log("postsForums",postsForums)
    filename = filename.substr(0, 4);
    console.log("filename", filename)
    return new Promise(function(resolve, reject) {
        
        let postType = "";
        let i = 0;
        let usersInPost = new Set();
        for(let value of posts){
            // console.log("value.name", value.name)
            let post = {};
            let author = {};

            author.name = value.name;                     //名字        
            author.username = value.username;             //用户名
            author.questions = 0;                         //初始化提问数
            author.articles = 0;                          //初始化文章数
            author.replys = 0;                            //初始化回复数
            author.posts = [];                            //初始化帖子详情

            if(i == 0) {
                post.created_at = value.created_at;         //创建时间
                // post.cooked = posts[i].cooked;                 //帖子内容
                post.link = url + filename;
                post.forum = postsForums.get(filename);
                // post.title = title;
                
                let createDate = new Date(post.created_at);
                console.log("createDate", createDate);
                if(createDate > endDate) {
                    resolve("OutOfDate");
                }
                
                // console.log("length", author.cooked.toString().length);
                let str = value.cooked.toString();
                let countChinese = 0;
                for(let j = 0; j < str.length; j++) {
                    let ch = str.charCodeAt(j);
                    if(ch > 255)countChinese++;
                }
                // console.log("countChinese", countChinese);
                if(countChinese >= 500) {
                    post.type = type.ARTICLE;
                    postType = type.ARTICLE;
                }
                else {
                    post.type = type.QUESTION;
                    postType = type.QUESTION;
                }
                // console.log("author.name", author.name)
                if(!usersPosts.has(author.name)) {
                    if(post.type === type.ARTICLE) {
                        author.articles = 1;
                    }
                    else author.questions = 1;
                    author.posts.push(post);
                }
                else {
                    author = usersPosts.get(author.name);
                    if(post.type === type.ARTICLE) {
                        author.articles += 1;
                    }
                    else {
                        author.questions += 1;
                    }
                    author.posts.push(post);
                }
                
                usersPosts.set(author.name, author);
                usersInPost.add(author.name)
            }
            else if(postType === type.QUESTION) {
                // console.log("question", posts[i].name)
                //如果该帖子回复用户中没有该用户才计入统计
                
                if(!usersInPost.has(value.name)) {
                    post.created_at = value.created_at;         //创建时间
                    // post.cooked = value.cooked;                 //帖子内容
                    let index = i + 1;
                    post.link = url + filename + "/" + index.toString();               
                    post.forum = postsForums.get(filename);
                    post.type = type.REPLY;
                    // post.title = title;

                    if(!usersPosts.has(author.name)) {
                        author.replys = 1;
                        author.posts.push(post);
                    }
                    else {
                        author = usersPosts.get(author.name);
                        if(author.replys != undefined)author.replys += 1;
                        else author.replys = 1;
                        author.posts.push(post);
                    }
                    usersPosts.set(author.name, author);
                    usersInPost.add(author.name);
                    // console.log("==========usersPosts", JSON.stringify(usersPosts.get(author.name)))
                        
                }
            }
            else {
                break;
            }
            // fs.writeFileSync("./usersPosts.txt", JSON.stringify(usersPosts))
            i ++;
        }
        resolve("success")
    })
}

async function run() {
    fs.removeSync('./data');
    fs.ensureDirSync(path);
    await getBatchForum();
    await getBatchJson();
    await getResult()
    readFile()
}

run()