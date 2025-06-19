const express = require('express');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();

app.use(express.json());
const PORT = 3000;

dbPath = path.join(__dirname, 'mydb.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if(err){
        console.log(err)
    } else{
        console.log('ok')
        initDB()
    }
})

function initDB() {

    db.run(
        `CREATE TABLE IF NOT EXISTS users (
        userID INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        password TEXT NOT NULL
        )`, (err) => {
            if(err) {
                console.log(err)
            } else {
                console.log('Таблица users создана')
            }
        }
    );
    
    db.run(
        `CREATE TABLE IF NOT EXISTS post (
        postID INTEGER PRIMARY KEY AUTOINCREMENT,
        post TEXT NOT NULL
        )`, (err) => {
            if(err) {
                console.log(err)
            } else {
                console.log('Таблица post создана')
            }
        }
    );
}

app.post('/user', (req, res) => {
  const user = req.body;
  if (!user.name || !user.password){ 
    res.status(400).json({
        message: 'имя и пароль должны быть заполнены'
    })
  }
  else {
    db.run(`INSERT INTO users (name, password) VALUES (?, ?)`, [user.name, user.password], (err) => {
        if(err) {
            console.log(err) // Для отладки
            res.status(500).json({ error: 'Ошибка базы данных' })
        } else {
            res.status(201).json({ message: 'Пользователь создан' })
        }
    })
  }
})

app.get('/user/:id', (req, res) => {
    const id = req.params.id; 
    
    if(!id) {
        res.status(400).json({ error: 'ID не указан' })
    } else {
        db.get(`SELECT * FROM users WHERE userID = ?`, [id], (err, row) => {
            if(err) {
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            } else if(!row) {
                res.status(404).json({ error: 'Пользователь не найден' })
            } else {
                res.status(200).json(row)
            }
        })
    }
})


app.post('/post', (req, res) => {
    const post = req.body
    if (!post.post){
        res.status(400).json({ error: 'Должен содержать текст поста!' })
    } else{
        db.run('INSERT INTO post (post) VALUES (?)', [post.post], (err) => {
            if(err){
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            }else{
                res.status(201).json({ message: 'Пост создан' })
            }
        })
    }
})

app.get('/post/:id', (req, res) => {
    const id = req.params.id
    if(!id){
        res.status(400).json({ error: 'ID не указан' })
    }else{
        db.get(`SELECT * FROM post WHERE postID = ?`, [id], (err, row) => {
            if(err){
                console.log(err)
                res.status(500).json({ error: 'Ошибка базы данных' })
            }else if(!row){
                res.status(404).json({ error: 'Пост не найден' })
            }else{
                res.status(200).json({
                    message: 'Пост найден',
                    post: row
                })
            }
        })
    }
})





app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`)
})
