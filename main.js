const rp = require('request-promise')
const superagent = require('superagent');
const cheerio = require("cheerio");
const fs = require('fs-extra');
const XLSX = require('xlsx');
var Agent = require('socks5-http-client/lib/Agent');
const async = require("async");
const request = require('request');

const startPage = 1606;
const endPage = 1685;

let uri = "http://blockgeek.org/t/topic/";
let urisArray = [];

for(let i = startPage; i < endPage; i++) {
    let tempUri = uri;
    urisArray.push(tempUri + i);
}

process.env.NODE_NO_HTTP2=1
// console.log(urisArray)

const type = {
    ARTICLE: 'Article',
    QUESTION: 'Question',
}

let bgPosts = [];
// let userNames = new Set();

let usersPosts = new Map();
// async function getData(startTime, endTime) {

//     //所有满足条件的帖子
    
// }
let dateFlag = false;

async function processArray(startTime, endTime) {

    let usersPosts = new Map();
    let startDate, endDate;
    

    startDate = new Date(startTime);
    endDate = new Date(endTime);
    console.log("startDate", startDate);
    console.log("endDate", endDate);
    
    let index = 0;
    for(let uri of urisArray) {
        index ++;
        if(index % 10 == 0) {
            await sleep();
        }
        // console.log("uri",uri)
        superagent.get(uri).end(async function(err, res){
            // console.log(res);
            var $ = cheerio.load(res.text);
            console.log("title", $("title").text());
            let title = $("title").text();
            let index1 = title.indexOf("-");
            let index2 = title.indexOf("-", index1 + 1);
            let forum = title.substr(index1 + 2, index2 - index1 - 3);
            
    
            if(forum === "ETH" || forum === "EOS" || forum === "BTC" || forum === "HPB" || forum === "DAG" || forum === "IPFS" || forum === "Other") {
                console.log("forum", forum);
                let options = {
                    uri: uri,
                    headers: {
                        'User-Agent': 'Request-Promise'
                    },
                    json: true ,
                    // agentClass: Agent,
                    // agentOptions: {
                    //     socksHost: 'localhost', // Defaults to 'localhost'.
                    //     socksPort: 1080 // Defaults to 1080.
                    // }
                };
        
                rp(options).then(async function(result){
                    let posts = result.post_stream.posts;
                    
                    let postType = "";
                    let i = 0;
                    for(let value of posts){
                        let usersInPost = new Set();
                        let post = {};
                        if(i == 0) {
                            let author = {};
                            author.name = value.name;                     //名字        
                            author.username = value.username;             //用户名
    
                            post.created_at = value.created_at;         //创建时间
                            // post.cooked = posts[i].cooked;                 //帖子内容
                            post.link = uri + "/1";
                            post.forum = forum;
                            post.title = title;
                            
                            let createDate = new Date(post.created_at);
                            console.log("createDate", createDate);
                            if(createDate < startDate || createDate > endDate) {
                                if(createDate > endDate)dateFlag = true;
                                break;
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
                            usersInPost.add(author.name);
                        }
                        if(postType === type.QUESTION) {
                            // console.log("question", posts[i].name)
                            if(i > 0) {
                                let author = {};
                               
                                //如果该帖子回复用户中没有该用户才计入统计
                                if(!usersInPost.has(value.name)) {
                                    author.name = value.name;                     //名字        
                                    author.username = value.username;             //用户名
    
                                    post.created_at = value.created_at;         //创建时间
                                    // post.cooked = value.cooked;                 //帖子内容
                                    let index = i + 1;
                                    post.link = uri + "/" + index.toString();               
                                    post.forum = forum;
                                    post.title = title;
    
                                    if(!usersPosts.has(author.name)) {
                                        author.replys = 1;
                                        author.posts = [];
                                        author.posts.push(post);
                                    }
                                    else {
                                        author = usersPosts.get(author.name);
                                        author.replys += 1;
                                        author.posts.push(post);
                                    }
                                    usersPosts.set(author.name, author);
                                    usersInPost.add(author.name);
                                    // console.log("==========usersPosts", JSON.stringify(usersPosts.get(author.name)))
                                }
                                    
                            }
                        }
                        else {
                            break;
                        }
                        // fs.writeFileSync("./usersPosts.txt", JSON.stringify(usersPosts))
                        i ++;
                    }
                })
                .catch(error => {
                    console.log("error", error)
                })
            }
            
        })
         //超过当天日期，则停止循环
        if(dateFlag) {
            console.log("------------")
            let results = "";
            for (var [key, value] of usersPosts.entries()) {
                console.log(key + "=" + JSON.stringify(value));
                let result = key + "=" + JSON.stringify(value) + "\n";
                results += result;
            }
            fs.writeFileSync('./result.txt', results)
            reject(dateFlag);
            // break;
        }

    }
    
    
    // console.log("usersPosts", usersPosts)

}

function sleep() {
    return new Promise(resolve => setTimeout(resolve, 10000))
}

async function readFile() {

    const _headers = ['name', 'articles', 'questions', 'replys', 'rewards']
    let fileData = fs.readFileSync('./result.txt', "utf8").split('\n');
    let _data = [];
    for(let d of fileData) {
        let user = {};
        let sum = JSON.parse(d.split('=')[1])
        // console.log(sum)
        user.name = sum.name;
        user.articles = sum.articles == undefined ? 0 : sum.articles;
        user.questions = sum.questions == undefined ? 0 : sum.questions;
        user.replys = sum.replys == undefined ? 0 : sum.replys;
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
                        post.link = uri + "/1";
                        post.forum = forum;
                        post.title = title;
                        
                        let createDate = new Date(post.created_at);
                        console.log("createDate", createDate);
                        if(createDate < startDate || createDate > endDate) {
                            if(createDate > endDate)dateFlag = true;
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
                            post.link = uri + "/" + index.toString();               
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
            if(dateFlag) {

                reject(dateFlag);
                // break;
            }
        })
    });
}

// let promises =  [];

// for(let i = 0; i < 3; i++) {
//     let k = 0;
//     promises[i] = [];
//     for(let j = 0; j < urisArray.length; j++) {
//         promises[i][j] = getTitle(urisArray[k]);
//         k++;
//         if(j == 4)break;
//     }
//     // promises2.push(getPosts(urisArray[i]))
// }

function getJson(url) {
    return new Promise(function(resolve, reject){
        request(url+".json", function (error, response, body) {
            console.log('ERROR:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            // console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
            if(!error && response.statusCode == 200) {
                let result = JSON.parse(body);
                let posts = result.post_stream.posts;
                fs.writeFileSync('./data/posts/' + url.substr(url.length - 4, url.length) + '.txt', JSON.stringify(posts));
                resolve("success")
            }
            resolve("error")
        });
    })
}

function getForum(url) {
    return new Promise(function(resolve, reject){
        superagent.get(url).end(function(err, res){
            if(err) {
                console.log("ERROR superagent get url error")
                resolve("ERROR");
                // return;
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
            let index1 = title.indexOf(" - ");
            let index2 = title.indexOf(" - ", index1 + 1);
            console.log("index1index2", index1, index2)
            let forum = title.substr(index1 + 3, index2 - index1 - 3);
            fs.appendFileSync('./data/forum.txt', url + "|" +forum + "\n");
            resolve(forum);
        })
    })
}
let join = require('path').join;
let path = './data/posts/';

function getResult() {
    let files = fs.readdirSync(path);
    files.forEach(async function(filename){
        let fPath = join(path, filename);
        let stats=fs.statSync(fPath);
        if(stats.isFile()) {
            let posts = fs.readJsonSync(fPath);
            // console.log(posts);
            let result = await calculatePosts(posts);
            console.log("result",result)
            if(result === "OutOfDate") {
                console.log("result", usersPosts);
                return;
            }
        }
    })
    
}

function calculatePosts(posts) {
    return new Promise(function(resolve, reject) {
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
                post.link = uri + "/1";
                // post.forum = forum;
                // post.title = title;
                
                let createDate = new Date(post.created_at);
                console.log("createDate", createDate);
                if(createDate < startDate || createDate > endDate) {
                    if(createDate > endDate)dateFlag = true;
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
                    post.link = uri + "/" + index.toString();               
                    // post.forum = forum;
                    // post.title = title;

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
    })
}

async function run() {
    // for(let i = 0; i < urisArray.length; i++) {
    //     let result = await getTitle(urisArray[i]);
    //     console.log("result",result)
        
    // }
    // console.log(usersPosts)

    // let promises1 = [];
    // for(let i = 0; i < 10; i++) {
    //     promises1.push(getForum(urisArray[i]))
    // }
    // Promise.all(promises1).then((result => {
    //     console.log(result);
    // }))

    // let promises2 = [];
    // for(let i = 0; i < urisArray.length; i++) {
    //     let result = await getJson(urisArray[i]);
    //     console.log("result", result)
    // }
    getResult()
    // Promise.all(promises2).then((result => {
    //     console.log(result);
    // }))
    // let promises = [];
    // let promises2 = []
    // for(let i = 0; i < 5; i++) {
    //     promises.push(getTitle(urisArray[i]));
    // }
    
    // for(let i = 5; i < 10; i++) {
    //     promises2.push(getTitle(urisArray[i]))
    // }
    // for(let i = 0; i < promises.length; i++) {
    //     await Promise.all(promises[i]).then((result => {
    //         // console.log("result", result)
    //         // console.log("userPosts", usersPosts)
    //         let results = "";
    //         for (var [key, value] of usersPosts.entries()) {
    //             console.log(key + "=" + JSON.stringify(value));
    //             let result = key + "=" + JSON.stringify(value) + "\n";
    //             results += result;
    //         }
    //         fs.writeFileSync('./result'+i+'.txt', results)
    //     }))
    //     await sleep()
    // }
}

run()