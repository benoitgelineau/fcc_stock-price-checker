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
      const like = req.query.like ? req.query.like : false;
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
        const ip = /^(::ffff:)/.test(req.ip) ? req.ip.slice(7) : req.ip;
        

        mongo.connect(DB, (err, db) => {
          if (err) {
            console.log('Database error: ' + err);
          } else {
            console.log('Successful database connection');

            const collection = db.collection('stocks');

            // No 'likes' incrementation if IP in ips array
            collection.findOne(
              { 
                stock: stock,
                ips: { $in: [ip] }
              },
              (err, data) => {

                let updates = {};
                // User registered
                if (data) {
                  // No more than 1 like per user
                  if (like) {
                    updates = {};
                  // Remove like and user's ip if checkbox unchecked
                  } else {
                    updates = { $unset: { ips: ip }, $inc: { likes: -1 } };
                  }
                // User not registered
                } else {
                  // Add user's ip and +1 like
                  if (like) {
                    updates = {
                      $setOnInsert: { stock: stock },
                      $push: { ips: ip },
                      $inc: { likes: count }
                    };
                  // +1 like
                  } else {
                    updates = {
                      $setOnInsert: { stock: stock },
                      $inc: { likes: count }
                    };
                  }
                }

                collection.findAndModify(
                  { stock: stock },
                  {},
                  updates,
                  { upsert: true, new: true },
                  (err, data) => {
                    if (err) console.log(err);

                    res.json({
                      stockData: {
                        stock: data.value.stock,
                        price: price,
                        likes: data.value.likes
                      }
                    });
                    db.close();
                  }
                );
              }
            );
          }

        });

      };

      displayStock();
      
    });
    
};
