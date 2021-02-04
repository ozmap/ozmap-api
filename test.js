const express = require('express');
const app = express();
let {OZmap} = require("./index");
app.get('/box_img', async (req, res) => {
    let ozmap = new OZmap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2R1bGUiOiJhcGkiLCJ1c2VyIjoiNjAwZmY2OTkyMTJiMjAyZGFlZGY3YjM5IiwiY3JlYXRpb25EYXRlIjoiMjAyMS0wMi0wNFQxMzowMTo1NC4zNDBaIiwiaWF0IjoxNjEyNDQzNzE0fQ.cbdOBXv6XGr9mUneL4WNo-d4JApHiflzlQtx_5-aFfs", "http://christiantest.ozmap.com.br:9090");

    let {rows: [box]} = await ozmap.read("boxes", {hierarchyLevel: 2});
    await ozmap.authenticate({});
    let box_img = await ozmap.exportBox(box.id, [],"pdf");
    res.send(box_img);
});


app.get('/croqui_img', async (req, res) => {
    let ozmap = new OZmap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2R1bGUiOiJhcGkiLCJ1c2VyIjoiNjAwZmY2OTkyMTJiMjAyZGFlZGY3YjM5IiwiY3JlYXRpb25EYXRlIjoiMjAyMS0wMi0wNFQxMzowMTo1NC4zNDBaIiwiaWF0IjoxNjEyNDQzNzE0fQ.cbdOBXv6XGr9mUneL4WNo-d4JApHiflzlQtx_5-aFfs", "http://christiantest.ozmap.com.br:9090");

    let {rows: [property]} = await ozmap.read("properties", {});
    await ozmap.authenticate({});
    let croqui_img = await ozmap.exportCroqui(property.id, "pdf");
    res.send(croqui_img);
});

app.listen(3000, () => console.log('Gator app listening on port 3000!'));
