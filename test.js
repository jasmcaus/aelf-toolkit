const moment = require("moment")

const str = "2022/12/12 01:15:12"

const time = moment(str, "YYYY/MM/DD HH:mm:ss").milliseconds() * 1000

console.log(time)