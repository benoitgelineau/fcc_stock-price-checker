/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const axios = require('axios');
const mongo = require('mongodb').MongoClient;
const DB = process.env.DB;

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(function (req, res){
      const stock = req.query.stock;
      const like = req.query.like;
      let symbol = '';
      
      const getStockOne = async () => {
        symbol = typeof stock === 'string' ? stock : stock[0];
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${process.env.API_KEY}`;

        try {
          return await axios.get(url);
        } catch (error) {
          console.error(error);
        }
      };

      const displayStock = async () => {
        const api = await getStockOne();
        const stock = api.data['Meta Data']['2. Symbol'].toUpperCase();
        const date = api.data['Meta Data']['3. Last Refreshed'];
        const price = api.data['Time Series (1min)'][date]['4. close'].slice(0, -2);
        const count = like ? 1 : 0;
        
        mongo.connect( DB, (err, db) => {
          if (err) {
            console.log('Database error: ' + err);
          } else {
            console.log('Successful database connection');
          }

          // db.collection('likes').findAndModify(
          //   { stock: stock },
          //   {},
          //   {
          //     $setOnInsert: {
          //       stock: stock,
          //       likes: count,
          //       ip: [req.ip]
          //     },
          //     $push: {
          //       ip: req.ip // Push only if doesn't exist already
          //     },
          //     $inc: {
          //       likes: count // Increment only if like is true
          //     }
          //   },
          //   { upsert: true, new: true },
          //   (err, data) => {

          //     console.log(data);
          //     res.json({
          //       stockData: {
          //         stock: stock,
          //         price: price,
          //         likes: count
          //       }
          //     });
          //   }
          // );
        });

      };

      displayStock();
      
    });
    
};
