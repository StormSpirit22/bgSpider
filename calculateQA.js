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
let usersDetails = new Map();
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
        // 爬取网页标题
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
            await page.goto(url, {timeout: 1000000});
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
                    // console.log("forum", forum);
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
            // this.closeBrowser();
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
            await page.goto(url + '.json', {timeout: 1000000});
            // page.waitFor(1000);
            // 获取信息
            try {
                // 获取文本
                let innerText = await page.evaluate(() =>  {
                    console.log('document.querySelector("body").innerText', document.querySelector("body").innerText);
                    return JSON.parse(document.querySelector("body").innerText); 
                }); 
                fs.writeFileSync('./data/posts/' + url.substr(url.length - 4, url.length) + '.txt', JSON.stringify(innerText.post_stream.posts))
                return "success";

            } catch (error) {
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
                let result = await this.calculatePosts(posts,filename);
                console.log("result",result)
                if(result === "ExceedDate") {
                    return;
                }
            }
        }
    }
    
    calculatePosts(posts, filename) {
        filename = filename.substr(0, 4);
        console.log("filename", filename)
        return new Promise(function(resolve, reject) {
            let i = 0;
            let usersInPost = new Set();
            let postType = "";
            let postForum = postsForums.get(filename);
            for(let value of posts){
                let post = {};
                let author = {};
    
                author.name = value.name;                     //名字        
                author.username = value.username;             //用户名
                author.questions = 0;                         //初始化提问数
                author.articles = 0;                          //初始化文章数
                author.replys = 0;                            //初始化回复数
                author.posts = [];                            //初始化帖子详情
                author.hQuestions = 0;                        //海阔天空版块
                author.hReplys = 0;
                post.created_at = value.created_at;         //创建时间
                post.forum = postsForums.get(filename);
                post.title = postsTitles.get(filename);
                if(i == 0) {
                    // post.cooked = posts[i].cooked;                 //帖子内容
                    post.link = url + filename;
                    let createDate = new Date(post.created_at);
                    console.log("author createDate", createDate.toLocaleString());
    
                    //判断主题帖字符数是否大于800
                    let str = value.cooked.toString();
                    if(str.length >= 800) {
                        post.type = type.ARTICLE;
                        postType = type.ARTICLE;
                    } else {
                        post.type = type.QUESTION;
                        postType = type.QUESTION;
                    }
    
                    if(createDate > endDate) {
                        resolve("ExceedDate");
                    }
                    if(createDate >= startDate) {
                        if(!usersPosts.has(author.name)) {
                            if(postForum === '海阔天空') {
                                author.hQuestions = 1
                            }
                            author.questions = 1;
                        }
                        else {
                            author = usersPosts.get(author.name);
                            if(postForum === '海阔天空') {
                                author.hQuestions += 1
                            }
                            author.questions += 1;
                        }
                        author.posts.push(post);
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
                    console.log("reply createDate", createDate.toLocaleString());
                    if(createDate >= startDate && createDate <= endDate) {
                         //如果该帖子回复用户中没有该用户才计入统计，比如一个用户回复两次也只计算一次奖励，自问自答没有奖励
                        if(!usersInPost.has(value.name)) {
                            // post.cooked = value.cooked;                 //帖子内容
                            let index = i + 1;
                            post.link = url + filename + "/" + index.toString();               
                            post.type = type.REPLY;
    
                            if(!usersPosts.has(author.name)) {
                                if(postForum === '海阔天空') {
                                    author.hReplys = 1
                                }
                                author.replys = 1;
                            }
                            else {
                                author = usersPosts.get(author.name);
                                if(postForum === '海阔天空') {
                                    author.hReplys += 1
                                }
                                author.replys += 1;
                            }
                            author.posts.push(post);
                            usersPosts.set(author.name, author);
                            usersInPost.add(author.name);
                            if(!users.includes(author.username)) {
                                users.push(author.username);
                            }
                        }
                    }
                }
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
        return new Promise((resolve, reject) => {
            request("http://blockgeek.org/u/" + username + ".json", function(error, response, body) {
                if(!error && response.statusCode == 200) {
                    let result = JSON.parse(body);
                    let userFields = objToStrMap(result.user.user_fields);
                    let userTitle = result.user.title === null ? "" : result.user.title;
                    let address = userFields.get("1") === null ? "": userFields.get("1");
                    usersAddress.set(username, address);
                    let details = {};
                    details.address = address;
                    details.rank = userTitle;
                    usersDetails.set(username, details);
                    resolve("Success")
                }
                resolve("Error")
            })
        })
    }

    async writeFile() {

        console.log("=====usersDetails=====", usersDetails)
        let _headers = ['name', 'username', 'questions', 'replys', 'rewards', 'address', 'rank'];
        let _headers2 = ['name', 'username', 'link', 'title', 'created_at', 'forum'];
        let _data = [];
        let _posts = [];
        for (var [key, value] of usersPosts) {
            let user = {};
            user.name = value.name;
            user.username = value.username;
            user.questions = value.questions;
            user.replys = value.replys;
            user.rewards = (parseFloat(value.questions) * 1 + parseFloat(value.replys) * 5) - (parseFloat(value.hQuestions) * 0.4 + parseFloat(value.hReplys) * 2);
            user.address = usersDetails.get(value.username).address;
            user.rank = usersDetails.get(value.username).rank;
            _data.push(user)
            for(let p of value.posts) {
                let post = {}
                post.name = value.name;
                post.username = value.username;
                post.link = p.link;
                post.title = p.title;
                post.created_at = new Date(p.created_at.toString()).toLocaleString();
                post.forum = p.forum;
                _posts.push(post)
            }
        }
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
new QuestionSpider()