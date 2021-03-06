const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const request = require('request');
const config = require('./config.json');
const XLSX = require('xlsx');

// 延时器
let timeout = function (delay) {
  console.log('延迟函数：', `延迟 ${delay} 毫秒`)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(1)
      } catch (error) {
        reject(error)
      }
    }, delay);
  })
}

const startPage = config.startPage;
const endPage = config.endPage;
let startDate = new Date(config.startDate);
let endDate = new Date(config.endDate);
console.log(startDate, endDate)

const type = {
    ARTICLE: 'Article',
    QUESTION: 'Question',
    REPLY: 'Reply',
}


let usersPosts = new Map();
let postsForums = new Map();
let postsTitles = new Map();
let users = [];
let validPosts = [];
let usersAddress = new Map();


let url = "http://blockgeek.org/t/topic/";
let urlsArray = [];

for(let i = startPage; i <= endPage; i++) {
    let tempurl = url;
    urlsArray.push(tempurl + i);
}

let join = require('path').join;
let path = './data/posts/';
/**
 * One 爬虫类
 */

class QuestionSpider {
    constructor () {
        // 最大索引
        process.setMaxListeners(0);
        // 初始化
        this.init()
        
    }
    // 初始化函数
    async init () {
        
        fs.removeSync('./data');
        fs.ensureDirSync(path);
        console.log('正在启动浏览器...')
        this.browser = await puppeteer.launch();
        console.log('正在打开新页面...')
        this.page = await this.browser.newPage();
        // 顺序爬取页面
        await this.getBatchForum();
        await this.getBatchJson();
        await this.getResult();
        await this.getBatchUsersAddress();
        this.writeFile();
        this.closeBrowser();
    }

    async getBatchForum() {
        for(let i = 0; i < urlsArray.length; i++) {
            // console.log("urlsArray[i]",urlsArray[i])
            let result = await this.getForum(urlsArray[i]);
            console.log("forum result", result)
        }
    }
    
    async getForum(url) {
        try{
            let page = this.page;
            await page.goto(url);
            page.waitFor(1000);
            // 获取信息
            try {
                // 获取title
                let title = await page.title();
                let forum = "";
                console.log("title", title)
                // if(title.includes('【提问】')) {
                    let index1 = title.indexOf(" - ");
                    let index2 = title.indexOf(" - ", index1 + 1);
                    // console.log("index1index2", index1, index2)
                    forum = title.substr(index1 + 3, index2 - index1 - 3);
                    fs.appendFileSync('./data/forum.txt', url + "|" +forum + "\n");
                    console.log("forum", forum);
                    let filename = url.substr(url.length - 4, url.length);
                    if(forum === "ETH" || forum === "EOS" || forum === "BTC" || forum === "HPB" || forum === "DAG" || forum === "IPFS" || forum === "Other" || forum === "海阔天空") {
                        postsForums.set(filename, forum);
                        postsTitles.set(filename, title);
                        validPosts.push("http://blockgeek.org/t/topic/" + filename);
                    }
                    return forum;
                // }
    
            } catch (error) {
                console.log("error", error);
            }
        } catch(error) {
            console.log("=======getForum Error=======")
            console.log(error);
            console.log("============================")
            this.closeBrowser();
        }
    }

    async getBatchJson() {
        for(let i = 0; i < validPosts.length; i++) {
            let result = await this.getJson(validPosts[i]);
            console.log("json result", result)
        }
    }
    
    async getJson(url) {
        let page = this.page
        try{
            console.log("url", url);
            await page.goto(url + '.json');
            // page.waitFor(1000);
            // 获取信息
            try {
                // 获取文本
                // console.log("page", page)
                // var content = await page.content(); 
                // console.log("content", content)
                
                let innerText = await page.evaluate(() =>  {
                    console.log('document.querySelector("body").innerText', document.querySelector("body").innerText);
                    return JSON.parse(document.querySelector("body").innerText); 
                }); 
                // console.log("innerText", innerText.post_stream.posts)
                fs.writeFileSync('./data/posts/' + url.substr(url.length - 4, url.length) + '.txt', JSON.stringify(innerText.post_stream.posts))
                // console.log("success");
                return "success";
                // console.log(innerText);

            } catch (error) {
                // console.log("error", error);
                return "error"
            }
        } catch(error) {
            console.log("======getJson Error========")
            console.log(error);
            console.log("===========================")
            // this.closeBrowser();
        }
    }

    async getResult() {
        let files = fs.readdirSync(path);
        for(let filename of files) {
            let fPath = join(path, filename);
            let stats=fs.statSync(fPath);
            if(stats.isFile()) {
                let posts = fs.readJsonSync(fPath);
                // console.log(posts);
                let result = await this.calculatePosts(posts,filename);
                console.log("result",result)
                if(result === "ExceedDate") {
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
    }
    
    calculatePosts(posts, filename) {
        // console.log("postsForums",postsForums)
        filename = filename.substr(0, 4);
        console.log("filename", filename)
        return new Promise(function(resolve, reject) {
            let i = 0;
            let usersInPost = new Set();
            let postType = "";
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
                post.created_at = value.created_at;         //创建时间
                post.forum = postsForums.get(filename);
                post.title = postsTitles.get(filename);
                // console.log("post")
                if(i == 0) {
                    // post.cooked = posts[i].cooked;                 //帖子内容
                    post.link = url + filename;
                    // post.title = title;
                    
                    let createDate = new Date(post.created_at);
                    console.log("author createDate", createDate);
    
                    //判断主题帖字数是否大于500
                    let str = value.cooked.toString();
                    let countChinese = 0;
                    for(let j = 0; j < str.length; j++) {
                        let ch = str.charCodeAt(j);
                        if(ch > 255)countChinese++;
                    }
                    console.log("countChinese", countChinese);
                    if(countChinese >= 500) {
                        post.type = type.ARTICLE;
                        postType = type.ARTICLE;
                    }
                    else {
                        post.type = type.QUESTION;
                        postType = type.QUESTION;
                    }
    
                    if(createDate > endDate) {
                        resolve("ExceedDate");
                    }
                    if(createDate >= startDate) {
                        // console.log("length", author.cooked.toString().length);
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
                        if(!users.includes(author.username)) {
                            users.push(author.username);
                        }
                    }
                }
                else if(postType === type.QUESTION){
                    console.log("question", posts[i].name)
                    let createDate = new Date(post.created_at);
                    console.log("reply createDate", createDate);
                    if(createDate >= startDate && createDate <= endDate) {
                         //如果该帖子回复用户中没有该用户才计入统计，比如一个用户回复两次也只计算一次奖励，自问自答没有奖励
                        if(!usersInPost.has(value.name)) {
                            // post.cooked = value.cooked;                 //帖子内容
                            let index = i + 1;
                            post.link = url + filename + "/" + index.toString();               
                            post.type = type.REPLY;
                            // post.title = title;
    
                            if(!usersPosts.has(author.name)) {
                                author.replys = 1;
                            }
                            else {
                                author = usersPosts.get(author.name);
                                if(author.replys != undefined)author.replys += 1;
                                else author.replys = 1;
                            }
                            author.posts.push(post);
                            usersPosts.set(author.name, author);
                            usersInPost.add(author.name);
                            if(!users.includes(author.username)) {
                                users.push(author.username);
                            }
                            // console.log("==========usersPosts", JSON.stringify(usersPosts.get(author.name)))
                        }
                    }
                }
                // fs.writeFileSync("./usersPosts.txt", JSON.stringify(usersPosts))
                i ++;
            }
            resolve("success")
        })
    }

    async getBatchUsersAddress() {
        for(let username of users) {
            let result = await this.getUsersAddress(username);
            console.log("getUsersAddress result", result);
        }
    }
    
    async getUsersAddress(username) {
        console.log("getUsersAddress");
        // console.log(users);
        return new Promise((resolve, reject) => {
            request("http://blockgeek.org/u/" + username + ".json", function(error, response, body) {
                // console.log('ERROR:', error); // Print the error if one occurred
                // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                // console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
                if(!error && response.statusCode == 200) {
                    let result = JSON.parse(body);
                    // console.log("result", result)
                    let userFields = objToStrMap(result.user.user_fields);
                    console.log("userFields", userFields);
                    // objToStrMap(userFields));
                    let address = userFields.get("1");
                    if(address === null)address = "";
                    usersAddress.set(username, address);
                    // console.log("usersAddress", usersAddress);
                    resolve("Success")
                }
                resolve("Error")
            })
        })
        // console.log("getUsersAddress");
        // console.log(users);
        // let page = this.page
        // try{
        //     await page.goto("http://blockgeek.org/u/" + username + ".json");
        //     // page.waitFor(1000);
        //     // 获取信息
        //     try {
        //         // 获取文本
        //         // console.log("page", page)
        //         // var content = await page.content(); 
        //         // console.log("content", content)
                
        //         let innerText = await page.evaluate(() =>  {
        //             console.log('document.querySelector("body").innerText', document.querySelector("body").innerText);
        //             return JSON.parse(document.querySelector("body").innerText); 
        //         }); 
        //         let result = innerText;
        //         // console.log("result", result)
        //         let userFields = this.objToStrMap(result.user.user_fields);
        //         console.log("userFields", userFields);
        //         // objToStrMap(userFields));
        //         usersAddress.set(username, userFields.get("1"));
        //         console.log("usersAddress", usersAddress);
        //         // console.log("success");
        //         return "success";
        //         // console.log(innerText);

        //     } catch (error) {
        //         // console.log("error", error);
        //         return "error"
        //     }
        // } catch(error) {
        //     console.log("======getJson Error========")
        //     console.log(error);
        //     console.log("===========================")
        //     // this.closeBrowser();
        // }
    }

    async writeFile() {

        console.log("=====usersAddress=====", usersAddress)
        let _headers = ['name', 'username', 'questions', 'replys', 'rewards', 'address'];
        let _headers2 = ['name', 'username', 'link', 'title', 'forum'];
        let _data = [];
        let _posts = [];
        for (var [key, value] of usersPosts) {
            // console.log("value", value);
            let user = {};
            user.name = value.name;
            user.username = value.username;
            user.questions = value.questions;
            user.replys = value.replys;
            user.rewards = parseInt(user.questions) * 1 + parseInt(user.replys) * 5;
            user.address = usersAddress.get(user.username);
            _data.push(user)
            // console.log("value.posts", value.posts)
            for(let p of value.posts) {
                let post = {}
                post.name = value.name;
                post.username = value.username;
                post.link = p.link;
                post.title = p.title;
                post.forum = p.forum;
                _posts.push(post)
            }
        }
        // console.log("_data", _data)
        // console.log("_posts", _posts)
        if(_data.length !== 0) {
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
            XLSX.writeFile(wb, '用户奖励.xlsx');
        }
    
        if(_posts.length !== 0) {
            var headers = _headers2
            .map((v, i) => Object.assign({}, {v: v, position: String.fromCharCode(65+i) + 1 }))
            .reduce((prev, next) => Object.assign({}, prev, {[next.position]: {v: next.v}}), {});
            var data = _posts
            .map((v, i) => _headers2.map((k, j) => Object.assign({}, { v: v[k], position: String.fromCharCode(65+j) + (i+2) })))
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
            XLSX.writeFile(wb, '帖子详情.xlsx');
        }
    }
    
    // 抓取页面内容
    async getPageInfo (actPage) {
        // 延时 1000 毫秒
        // await timeout(1000);
        let page = this.page
        try{
            await page.goto(`http://blockgeek.org/t/topic/${actPage}.json`);
            // 获取信息
            try {
                // 获取文本
                // console.log("page", page)
                var content = await page.content(); 
                // console.log("content", content)
                
                let innerText = await page.evaluate(() =>  {
                    console.log('document.querySelector("body").innerText', document.querySelector("body").innerText);
                    return JSON.parse(document.querySelector("body").innerText); 
                }); 
                // console.log("innerText", innerText)
                fs.writeFileSync('./test/' + actPage + '.txt', JSON.stringify(innerText))
                console.log("success");
                // console.log(innerText);

            } catch (error) {
                console.log("error");
            }
        } catch(error) {
            console.log("==============")
            console.log(error);
            console.log("==============")
        }
    
    }
  // 关闭浏览器
    async closeBrowser () {
        console.log('正在关闭浏览器...')
        await this.browser.close();
        return;
    }
}

function strMapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k,v] of strMap) {
        // We don’t escape the key '__proto__'
        // which can cause problems on older engines
        obj[k] = v;
    }
    return obj;
}
function objToStrMap(obj) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
        strMap.set(k, obj[k]);
    }
    return strMap;
}

// 启用爬虫
// new OnePaChong()
// getBatchForum()
new QuestionSpider()