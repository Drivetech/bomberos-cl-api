'use strict'

const fs = require('fs')
const got = require('got')
const cheerio = require('cheerio')
const bluebird = require('bluebird')
const NodeGeocoder = require('node-geocoder')

const options = { provider: 'google' }

const geocoder = NodeGeocoder(options)

const getData = link => {
  return got(link).then(response => {
    const $ = cheerio.load(response.body)
    const name = $('#nombre').val()
    const rawAddress = $('#direccion').val()
    const [address, _] = rawAddress.split(', ') // eslint-disable-line
    const phone = $('h2:contains("Teléfono:")').next().text() || ''
    const lat = parseFloat($('#glat').val())
    const lng = parseFloat($('#glng').val())
    const data = {
      name: name,
      address: address,
      phone: phone,
      latitude: lat,
      longitud: lng
    }
    return geocoder
      .reverse({ lat: lat, lon: lng })
      .then(results => {
        if (results.length === 0) return data
        data.commune =
          results[0].city || results[0].administrativeLevels.level3short
        data.country = results[0].country
        data.region = results[0].administrativeLevels.level1short
        return data
      })
      .catch(() => {
        return data
      })
  })
}

const getAllData = links => bluebird.map(links, getData)

const toCsv = results => {
  const ws = fs.createWriteStream('bomberos.csv')
  const fields = [
    'address',
    'commune',
    'country',
    'latitude',
    'longitude',
    'name',
    'phone',
    'region'
  ]
  const fieldsString = fields.map(field => `"${field}"`).join(',')
  ws.write(`${fieldsString}\n`)
  results.forEach(result => {
    const fields = [
      result.address,
      result.commune,
      result.country,
      result.latitude,
      result.longitude,
      result.name,
      result.phone,
      result.region
    ]
    const fieldsString = fields.map(field => `"${field}"`).join(',')
    ws.write(`${fieldsString}\n`)
  })
  ws.end()
}

const toJson = results => {
  const ws = fs.createWriteStream('bomberos2.json')
  ws.write(JSON.stringify(results))
  ws.end()
}

const getLinks = () => {
  const link = 'http://www.bomberos.cl/php/Cuerpos_de_Bomberos.php'
  return got(link).then(response => {
    const $ = cheerio.load(response.body)
    return $('.li-esc2 > a')
      .map(function () {
        return `http://www.bomberos.cl/php/${$(this).attr('href').trim()}`
      })
      .get()
  })
}

getLinks().then(getAllData).then(results => {
  toCsv(results)
  toJson(results)
})
