/**
 * Tests that time-series inserts respect {ordered: false}.
 */
(function() {
'use strict';

load('jstests/core/timeseries/libs/timeseries.js');
load('jstests/libs/fail_point_util.js');

const conn = MongoRunner.runMongod();

if (!TimeseriesTest.timeseriesCollectionsEnabled(conn)) {
    jsTestLog('Skipping test because the time-series collection feature flag is disabled');
    MongoRunner.stopMongod(conn);
    return;
}

const testDB = conn.getDB(jsTestName());

const coll = testDB.getCollection('t');
const bucketsColl = testDB.getCollection('system.buckets.' + coll.getName());

const timeFieldName = 'time';
const metaFieldName = 'meta';

coll.drop();
assert.commandWorked(testDB.createCollection(
    coll.getName(), {timeseries: {timeField: timeFieldName, metaField: metaFieldName}}));
assert.contains(bucketsColl.getName(), testDB.getCollectionNames());

const fp = configureFailPoint(conn, 'failTimeseriesInsert', {metadata: 'fail'});

const docs = [
    {_id: 0, [timeFieldName]: ISODate()},
    {_id: 1, [timeFieldName]: ISODate(), [metaFieldName]: 'fail'},
    {_id: 2, [timeFieldName]: ISODate()}
];
const res = assert.commandFailed(coll.insert(docs, {ordered: false}));
jsTestLog('Checking insert result: ' + tojson(res));
assert.eq(res.nInserted, 2);
assert.eq(res.getWriteErrors().length, 1);
assert.eq(res.getWriteErrors()[0].index, 1);
assert.docEq(res.getWriteErrors()[0].getOperation(), docs[1]);
assert.docEq(coll.find().sort({_id: 1}).toArray(), [docs[0], docs[2]]);

MongoRunner.stopMongod(conn);
})();