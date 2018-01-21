const express = require('express')
const app = express()
const crypto = require('crypto')
const request = require('request')
const session = require('express-session')
const multer = require('multer')
const upload = multer({dest: 'uploads/'})
const fs = require('fs')
const secrets = require('./secrets.js')
const path = require('path')

const authURL = secrets.authURL

function hasAccessToken(req) {
  return ('access_token' in req.session)
}

app.use('/views', express.static(path.join(__dirname + '/views')))

app.use(session({
  secret: crypto.randomBytes(10).toString('hex'),
  saveUninitialized: false,
  resave: false,
  maxAge: 315359999
}))

app.get('/', (req, res) => {
  if(hasAccessToken(req)) {
    res.redirect('/file')
  }
  else {
    req.session.state = crypto.randomBytes(10).toString('hex')
    res.redirect(authURL + req.session.state)
  }
})

app.get('/callback', (req, res) => {
  if(req.query.state != req.session.state) {
    //state value received does not match state value sent
    res.redirect('/')
  }
  else {
    //state values do match
    request.post({url:'https://api.quizlet.com/oauth/token', headers: secrets.tokenHeader, form: {grant_type:'authorization_code', code:req.query.code, redirect_uri:'http://localhost:3000/callback', }}, function(err,httpResponse,body){
      access_token = JSON.parse(body).access_token
      if(access_token) {
        //success
        req.session.access_token = access_token
        res.redirect('/file')
      }
      else {
        //failure
        res.redirect('/')
      }
    })
  }
})

app.get('/file', (req, res) => {
  if(!hasAccessToken(req)) {
    res.redirect('/')
  }
  else {
    res.sendFile(path.join(__dirname, 'views/index.html'))
  }
})

app.post('/submit', upload.single('input'), (req, res) => {
  if(!hasAccessToken(req)) {
    res.redirect('/')
  }
  else {
    fs.readFile(req.file.path, 'utf8', function(err, contents) {
      applyRegex(contents, req.body.fileRegex, req.body.title, req.session.access_token, res)
    })
  }
})

function applyRegex(text, fileRegex, title, token, res) {
  var regex = new RegExp(fileRegex, "g"), result
  var terms = [], defs = []

  while((result = regex.exec(text)) != null) {
    terms.push(result[1])
    defs.push(result[2])
  }
  createQuizlet(terms, defs, title, token, res)
}

function createQuizlet(terms, defs, title, token, res) {
  var bodyStr = "title="+title+"&lang_terms=en&lang_definitions=en"

  for(let i = 0; i < terms.length; i++) {
    bodyStr+="&terms[]="+terms[i]+"&definitions[]="+defs[i]
  }

  request.post({url: 'https://api.quizlet.com/2.0/sets', headers: {'Authorization': 'Bearer ' + token, 'content-type' : 'application/x-www-form-urlencoded'}, body: bodyStr}, function(err,httpResponse,body) {
    res.redirect(JSON.parse(body).url)
  })
}

app.listen(3000, () => {
  console.log('Listening on port 3000')
})
