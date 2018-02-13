const format = require('../parser/parse');
const sqsFilter = require('../queue/postFilteringQueue');
const cassandraDriver = require('cassandra-driver');
const cassandra = new cassandraDriver.Client({
  contactPoints: ['127.0.0.1:9042', '127.0.0.1:7199'], 
  keyspace: 'user_analytics_dev'
  // keyspace: 'user_analytics' 
});

/* =============
== INSERTIONS ==
==============*/
/* 
  user_id int,
  created_at timestamp,
  event_type text,
  product_id int,
  PRIMARY KEY (user_id, created_at)
*/
const insertIntoEventsByUserId = item => {
  console.log('inserting into database events_by_user_id');

  let query = 'INSERT INTO events_by_user_id (user_id, created_at, event_type, product_id) VALUES (?, ?, ?, ?)';
  let params = [ item.userId, new Date().toISOString(), item.event, item.productId ];
  cassandra.execute(query, params, { prepare: true })
  .then(result => console.log('insert into events_by_user_id successful!', result))
  .catch(err => console.log('Err: ', err));
}

const insertIntoEventsByProductId = item => {
  console.log('inserting into database events_by_product_id');
  let query = 'INSERT INTO events_by_product_id (product_id, created_at, event_type, user_id) VALUES (?, ?, ?, ?)';
  let params = [ item.productId, new Date().toISOString(), item.event, item.userId ];
  cassandra.execute(query, params, { prepare: true })
  .then(result => console.log('insert into events_by_product_id successful!', result))
}

/* ==========
== QUERIES ==
===========*/

const selectEventsByCurrentWeek = async () => {
  let start = format.currentWeek()[0];
  let end   = format.currentWeek()[1];

  let query = `SELECT product_id, user_id, event_type FROM EVENTS_BY_PRODUCT_ID WHERE created_at >= '${start}' AND created_at <= '${end}' ALLOW FILTERING`;

  try { return await cassandra.execute(query, []) }
  catch (err) { console.log(err); }
}

const selectEventsByCurrentWeekCustom = async (start, end) => {
  let query = `SELECT product_id, user_id, event_type FROM EVENTS_BY_PRODUCT_ID WHERE created_at >= '${start}' AND created_at <= '${end}' LIMIT 10 ALLOW FILTERING`;
  let options = {
    prepare: true,
    autoPage: true,
    fetchSize: 100000
  };

  var counter = 0;
  try { return await cassandra.stream(query, [], options)
    .on('readable', function() {
      var start = new Date();
      var row;
      while (row = this.read()) {
        // console.log('counter: ', counter, row);
        sqsFilter.postMessage(row);
        counter++;
      }
      var elapsed = new Date() - start;
      console.log(elapsed +  ' ms');
    })
    .on('end', function() {
      console.log('finished!');
    })
  }
  catch (err) { console.log(err); }
}

/* == Users Table == */
const selectAllUsers = async () =>  {
  try { return await cassandra.execute('SELECT * from users;', []) }
  catch (err) { console.log(err); }
}

const selectUserByUserId = async userId =>  {
  try { return await cassandra.execute(`SELECT * from users where id = ${userId};`, []) }
  catch (err) { console.log(err); }
}

/* == Events/Analytics Table == */
const selectAllByProductId = async () =>  {
  try { return await cassandra.execute('SELECT * from events_by_product_id;', []) }
  catch (err) { console.log(err); }
}

const selectAllByUserId = async () => {
  try { return await cassandra.execute('SELECT * from events_by_user_id;', []) }
  catch (err) { console.log(err); }
}

const selectEventsByProductId = async productId => {
  try { return await cassandra.execute(`SELECT * from events_by_product_id where product_id = ${productId};`, []) }
  catch (err) { console.log(err); }
}
const selectEventsByUserId = async userId => {
  try { return await cassandra.execute(`SELECT * from events_by_user_id where user_id = ${userId};`, []) }
  catch (err) { console.log(err); }
}

module.exports = {
  insertIntoEventsByUserId,
  insertIntoEventsByProductId,

  selectEventsByCurrentWeek,
  selectEventsByCurrentWeekCustom,

  selectAllUsers,
  selectUserByUserId,

  selectAllByProductId,
  selectAllByUserId,
  selectEventsByProductId,
  selectEventsByUserId,
}

