/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const axios = require('axios');
const async = require('async');

module.exports = function (app, db) {

  app.route('/api/stock-prices')
    .get(function (req, res){
      const symbol = req.query.stock;
      const collection = db.collection('stocks');
      
      const getStock = async symbol => {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${process.env.API_KEY}`;
        
        try {
          return await axios.get(url);
        } catch (error) {
          console.error(error);
        }
      };

      const displayStock = symbol => {

        if (typeof symbol === 'string') {

          setVariables(symbol).then(value => {
            handleOneStock(value.stock, value.price, value.like, value.count, value.ip);
          });

        } else {
          const promises = [setVariables(symbol[0]), setVariables(symbol[1])];
          
          Promise.all(promises)
            .then(values => {
              async.parallel(
                {
                  one: function(callback) {
                    collection.findOne({ stock: values[0].stock, ips: { $in: [values[0].ip] } }, callback);
                  },
                  two: function(callback) {
                    collection.findOne({ stock: values[1].stock, ips: { $in: [values[1].ip] } }, callback);
                  }
                },
                (err, results) => {
                  if (err) console.log('findOne error: ' + err);
                  
                  const updatesOne = setUpdates(results.one, values[0].stock, values[0].like, values[0].ip, values[0].count);
                  const updatesTwo = setUpdates(results.two, values[1].stock, values[1].like, values[1].ip, values[1].count);
  
                  async.parallel(
                    {
                      one: function(callback) {
                        collection.findAndModify({ stock: values[0].stock }, {}, updatesOne, { upsert: true, new: true }, callback);
                      },
                      two: function(callback) {
                        collection.findAndModify({ stock: values[1].stock }, {}, updatesTwo, { upsert: true, new: true }, callback);
                      }
                    },
                    (err, data) => {
                      if (err) console.log('findAndModify error: ' + err);
  
                      res.json({
                        stockData: [
                          {
                            stock: data.one.value.stock,
                            price: values[0].price,
                            rel_likes:
                              data.one.value.likes - data.two.value.likes
                          },
                          {
                            stock: data.two.value.stock,
                            price: values[1].price,
                            rel_likes:
                              data.two.value.likes - data.one.value.likes
                          }
                        ]
                      });
                    }
                  );
                }
              );
            })
            .catch(err => console.log(err));
        }
      };

      displayStock(symbol);

      async function setVariables(symbol) {
        const api = await getStock(symbol);
        const date = api.data['Meta Data']['3. Last Refreshed'];

        return {
          stock: api.data['Meta Data']['2. Symbol'].toUpperCase(),
          price: api.data['Time Series (1min)'][date]['4. close'].slice(0, -2),
          like: req.query.like ? req.query.like : false,
          count: req.query.like ? 1 : 0,
          ip: /^(::ffff:)/.test(req.ip) ? req.ip.slice(7) : req.ip
        }
      }

      function handleOneStock(stock, price, like, count, ip) {

        // No 'likes' incrementation if IP in ips array
        collection.findOne(
          {
            stock: stock,
            ips: { $in: [ip] }
          },
          (err, data) => {
            if (err) console.log(err);

            const updates = setUpdates(data, stock, like, ip, count);

            collection.findAndModify(
              {
                stock: stock
              },
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
              }
            );
          }
        );
      }

      function setUpdates(data, stock, like, ip, count) {
        let updates;
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
            updates = { $setOnInsert: { stock: stock }, $inc: { likes: count }, $push: { ips: ip } };
            // +1 like
          } else {
            updates = { $setOnInsert: { stock: stock }, $inc: { likes: count } };
          }
        }

        return updates;
      };
    });
    
};
