const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('hosts.db');

const express = require('express');

const app = express();

const bodyParser= require('body-parser');

app.use(express.static("css"));

app.use(bodyParser.urlencoded({extended: true}));

// initialize ejs template engine
app.engine('.ejs', require('ejs').__express);
app.set('view engine', 'ejs');

var currentServerId;
var interval ;
let errorMessage="Melden Sie sich bei einem Server an";
// Webserver starten http://localhost:3000
const port = 3000;
app.listen(port, function()
{
	console.log("listening on "+port);
});

const session = require('express-session');
app.use(session({secret: 'example', resave: false, saveUnitialized: true}));


app.get(['/', '/login'],(req,res)=>
{
	req.session["serverid"]= -1;
	req.session["userid"]= -1;
	clearInterval(interval);
	db.get(`select * from message where id=0`, function(err, rows)
	{
		if (err)
		{
			console.log(err.message);
			db.run(`CREATE Table user (id integer primary key autoincrement,name TEXT NOT NULL)`);
			db.run(`CREATE Table server (id integer primary key autoincrement,name TEXT NOT NULL UNIQUE,password TEXT)`);
			db.run(`CREATE Table message (id integer primary key autoincrement, serverid integer, userid integer,content TEXT NOT NULL,time TEXT)`);
		}
	});
	
	const sql = `SELECT server.name, server.id FROM server`;
	console.log(sql);
	db.all(sql, function(err, rows)
	{
		if (err)
		{
			console.log(err.message);
		}
		else
		{
			console.log(rows);
			res.render('login',{'message':errorMessage,'rows':  rows || []});
			errorMessage="Melden sie ich bei einem Server an";
		}
	});
});

app.get('/chat',(req,res)=>
{
	const sql = `SELECT message.content, message.userid, user.name, message.time FROM message INNER JOIN user ON message.userid=user.id WHERE serverid=${req.session["serverid"]}`;
	console.log(sql);
	db.all(sql, function(err, rows)
	{
		if (err)
		{
			console.log(err.message);
		}
		else
		{
			currentServerId=req.session["serverid"];
			currentUserId=req.session["userid"];
			app.locals.currentUserId=currentUserId;
			app.locals.currentServerId=currentServerId;
			db.get(`SELECT * FROM server WHERE id=${req.session["serverid"]}`,function(err, result)
			{
				if (err)
				{
					console.log(err.message);
				}
				else
				{				
					app.locals.currentServerName=result.name;
					interval = setInterval(syncChat, 1000);
					app.locals.rows=rows;
					res.render('chat');
				}
			});
		}
	});
});

function syncChat() 
{
	const sql = `SELECT message.content, message.userid, user.name, message.time FROM message INNER JOIN user ON message.userid=user.id WHERE serverid=${currentServerId}`;
	db.all(sql, function(err, rows)
	{
		if (err)
		{
			console.log(err.message);
		}
		else
		{
			app.locals.rows=rows;
		}
    });
}

app.post('/onjoin',function(req, res)
{
	const username = req.body["username"];
	const servername = req.body["servername"];
	console.log(servername);
	const passw = req.body["password"];
	const sql = 'SELECT * FROM server';
	console.log(sql);
	db.all(sql, function(err, rows)
	{
		console.log(rows);
		var nameexist=false;
		var passwcorrect=false;
		var connectedserverid=-1;
		for(x=0;x<rows.length;x++)
		{
			console.log(rows[x].id);
			if(rows[x].name == servername)
			{
				nameexist=true;
				if(rows[x].password == passw)
				{
					passwcorrect=true;
					connectedserverid=rows[x].id;
				}
			}
		}
		if(nameexist && passwcorrect)
		{
			req.session["serverid"]=connectedserverid;
			const sql1 = `INSERT INTO user (name) VALUES ('${username}')`;
			console.log(sql1);
			db.run(sql1, function(err)
			{
				if(err){console.log(err)}
				else
				{				
					req.session["userid"]=this.lastID;
					res.redirect('/chat');
				}
			});
		}
		else if(nameexist && !passwcorrect)
		{
			errorMessage="Invalid Password!";
			res.redirect('/login');
		}
		else
		{
			errorMessage="Server doesent exist!";
			res.redirect('/login');
		}
	
	});
});

app.post('/onhost',function(req, res)
{
	console.log("onhost");
	const username = req.body["username"];
	const servername = req.body["servername"];
	const passw = req.body["password"];
	db.all('SELECT * FROM server', function(err,rows)
	{
		var nameexist=false;
		for(x=0;x<rows.length;x++)
		{
			if(rows[x].name == servername)
			{
				nameexist=true;
			}
		}
		if(nameexist)
		{
			errorMessage="Server already exists!";
			res.redirect('/login');
		}
		else
		{
			const sql = `INSERT INTO user (name) VALUES ('${username}')`;
			console.log(sql);
			db.run(sql,function(err)
			{
				if(err){}
				else
				{
                    req.session["userid"]=this.lastID;
                }
			});
			const sql1 = `INSERT INTO server (name,password)	VALUES ('${servername}','${passw}')`;
			console.log(sql1);
			db.run(sql1,function(err)
			{
				if(err){}
				else
				{
					req.session["serverid"]=this.lastID;
					res.redirect('/chat');
				}
			});
		}
	});
	
});

app.post('/onsend',function(req, res)
{
	const message = req.body["message"];
	const sql = `INSERT INTO message (serverid,userid,content,time) VALUES (${req.session["serverid"]},${req.session["userid"]},'${message}',datetime('now','localtime'))`;
	console.log(sql);
	db.run(sql, function(err)
	{
		if(err){console.log(err);}	
	});
	res.redirect('/chat');
});