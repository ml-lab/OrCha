import * as d3 from 'd3';
import * as Color from 'color';
import { isNumeric } from './functions.js';
import {
  SplitStream,
  SplitStreamFilter,
  SplitStreamInputData,
  TransformData
} from '../libs/SplitStreams.js';
import { interpolateOranges } from 'd3-scale-chromatic';

export default class OrCha {
  constructor(container) {
    this._stream = new SplitStream(container, {
      mirror: true,
      offset: 'zero',
      transparentRoot: true,
      yPadding: 1
    });
    this._stream.proportion = 1;
    this._format;

    this._streamSize = 10;
  }

  set streamSize(value) {
    this._streamSize = value;
  }

  data(d) {
    return d == null ? this._format : (this._setData(d), this);
  }

  _setData(d) {
    this._format = new SplitStreamInputData({
      order: null
    });
    let innerTags = [];
    let streamTags = {}; // find correlated streams for outer tags
    let streamColors = {};

    d.streams.forEach(stream => (streamColors[stream.name] = stream.color));

    // randomly position tags above or below their corresponding stream
    let i = 0;
    for (let tag of d.tags) {
      tag.name = 'tag' + i++;
      tag.color = this.__getDarkerColor(streamColors[tag.stream]);
      if (tag.type == 'inner') innerTags.push(tag);
      else {
        if (!streamTags[tag.stream])
          streamTags[tag.stream] = { lower: [], upper: [] };
        let side;
        if (tag.type == 'upper' || tag.type == 'lower') side = tag.type;
        else side = Math.random() < 0.5 ? 'lower' : 'upper';

        streamTags[tag.stream][side].push(tag);
      }
    }

    // draw upper tags before the stream and lower tags after
    for (let stream of d.streams) {
      let streamHasTags = !!streamTags[stream.name];
      // add upper outer tags
      if (streamHasTags)
        for (let tag of streamTags[stream.name].upper) this._addTagNode(tag);
      // add streams
      this._addStream(stream);
      // add lower outer tags
      if (streamHasTags)
        for (let tag of streamTags[stream.name].lower) this._addTagNode(tag);
      // add links from stream to outer tags (or the other way around)
      if (streamHasTags) {
        for (let tag of streamTags[stream.name].upper) this._addTagLink(tag);
        for (let tag of streamTags[stream.name].lower) this._addTagLink(tag);
      }
    }

    // draw inner tags after streams to position them as children
    for (let tag of innerTags) this._addTagNode(tag);

    for (let link of d.links) this._addLinks(link);

    this._format.connectEqualIds();
    this._format.finalize();
    this._stream.data(this._format);
  }

  _addStream(stream) {
    if (stream.start > stream.end) return;

    for (let t = stream.start; t <= stream.end; t++) {
      this._format.addNode(t, stream.name, this._getSize(stream, t), null, {
        color: stream.color
      });
    }
    if (stream.parentStart) {
      this._format.addNext(stream.start, stream.parentStart, stream.name);
    }
    if (stream.parentEnd) {
      this._format.addNext(stream.end, stream.name, stream.parentEnd);
    }
  }

  _addLinks(link) {
    if (!isNumeric(link.start)) return;
    if (!isNumeric(link.end)) link.end = link.start;
    if (link.start > link.end) return;
    link.name = link.from + link.to;
    // stream moves fluently into the other stream
    if (link.type == 'merge') {
      this._format.addNext(link.end, link.from, link.to);
    } else {
      // stream attaches to the other stream
      let linkEnd = link.name + 'port';
      this._format.addNode(+link.end + 1, linkEnd);
      this._format.addParent(+link.end + 1, linkEnd, link.to);
      this._format.addNext(link.end, link.from, linkEnd);
    }
    // if (link.end - link.start == 0) {
    // } else {
    //   for (let t = +link.start + 1; t <= link.end; t++) {
    //     this._format.addNode(t, link.name);
    //   }
    //   this._format.addNext(link.start, link.from, link.name);
    //   this._format.addNext(link.end, link.name, linkEnd);
    // }
  }

  _addTagNode(tag) {
    let tagLengthHalf = 2;
    for (let t = tag.time - tagLengthHalf; t < +tag.time + tagLengthHalf; t++) {
      this._format.addNode(t, tag.name, null, null, {
        label: tag.text,
        color: tag.color
      });
      if (tag.type == 'inner') this._format.addParent(t, tag.name, tag.stream);
    }
  }

  _addTagLink(tag) {
    this._format.addNext(tag.time - 1, tag.stream, tag.name);
  }

  // expect stream values to be sorted
  _getSize(stream, t) {
    if (!stream.values) return this._streamSize;

    let keys = Object.keys(stream.values);
    if (keys.length == 0) return this._streamSize;

    let i = 0;
    for (let year of keys) {
      if (+t > +year) i++;
      else break;
    }
    let smaller = +(keys[i - 1] || stream.start);
    let bigger = +(keys[i] || stream.end);
    if (bigger == smaller) return stream.values[t] || this._streamSize;

    let prop = (+t - smaller) / (bigger - smaller);
    let smallerValue = +stream.values[smaller] || this._streamSize;
    let biggerValue = +stream.values[bigger] || this._streamSize;
    return smallerValue + prop * (biggerValue - smallerValue);
  }

  __getDarkerColor(color) {
    try {
      return Color(color)
        .darken(0.25)
        .hex();
    } catch (e) {
      return 'orange';
    }
  }
}
