var TJS = (function (Primitive, primitive) {

   var REF_KEY_PREFIX = '_';
   var REF_SEPARATOR = ';';
   var SINGLE_REF = REF_KEY_PREFIX + '0';
   var REF_PREFIX = {
     undefined: 'u',
     number: 'n',
     bigint: 'b',
     symbol: 's',
     RegExp: 'R',
     Map: 'M',
     Set: 'S'
   };

  /*!
   * ISC License
   *
   * Copyright (c) 2018, Andrea Giammarchi, @WebReflection
   */

  var TJS = {

    parse: function parse(text, reviver) {
      var input = JSON.parse(text, Primitives).map(primitives);
      var len = input.length;
      var refs = len > 1 ? input[len - 1] : [];
      var value = input[0];
      var $ = reviver || noop;
      var tmp = typeof value === 'object' && value ?
                  revive(input, refs, new Set, value, $) :
                  (value === SINGLE_REF && refs.length ? reviveRefs(refs, 0) : value);
      return $.call({'': tmp}, '', tmp);
    },

    stringify: function stringify(value, replacer, space) {
      for (var
        firstRun,
        known = new Map,
        knownRefs = new Map,
        refs = [],
        input = [],
        output = [],
        $ = replacer && typeof replacer === typeof input ?
              function (k, v) {
                if (k === '' || -1 < replacer.indexOf(k)) return v;
              } :
              (replacer || noop),
        i = +set(known, input, $.call({'': value}, '', value)),
        replace = function (key, value) {
          var after = $.call(this, key, value);
          var refIndex = setRefs(knownRefs, refs, after);

          if (refIndex) {
            return refIndex;
          }

          if (firstRun) {
            firstRun = !firstRun;
            return value;
            // this was invoking twice each root object
            // return i < 1 ? value : $.call(this, key, value);
          }

          switch (typeof after) {
            case 'object':
              if (after === null) return after;
            case primitive:
              return known.get(after) || set(known, input, after);
          }
          return after;
        };
        i < input.length; i++
      ) {
        firstRun = true;
        output[i] = JSON.stringify(input[i], replace, space);
      }
      refs.length && output.push(JSON.stringify(refs));
      return '[' + output.join(',') + ']';
    }

  };

  return TJS;

  function noop(key, value) {
    return value;
  }

  function reviveRefs (refs, index) {
    var value = refs[index].substring(2);

    switch (refs[index].charAt(0)) {
      case REF_PREFIX.undefined:
        refs[index] = undefined;
        break;
      case REF_PREFIX.number:
        refs[index] = Number(value);
        break;
      case REF_PREFIX.bigint:
        refs[index] = BigInt(value);
        break;
      case REF_PREFIX.symbol:
        refs[index] = Symbol.for(value);
        break;
      case REF_PREFIX.RegExp:
        var parts = /\/(.*)\/(.*)/.exec(value);
        refs[index] = new RegExp(parts[1], parts[2]);
        break;
      case REF_PREFIX.Map:
        refs[index] = new Map(TJS.parse(value));
        break;
      case REF_PREFIX.Set:
        refs[index] = new Set(TJS.parse(value));
        break;
    }

    return refs[index];
  }

  function revive(input, refs, parsed, output, $) {
    return Object.keys(output).reduce(
      function (output, key) {
        var value = output[key];
        if (value instanceof Primitive) {
          if (value.startsWith(REF_KEY_PREFIX)) {
            var index = value.substring(1);
            var tmp = refs[index];

            if (refs[index] instanceof Primitive) {
              reviveRefs(refs, index);
            }

            output[key] = refs[index];
            return output;
          }

          var tmp = input[value];
          if (typeof tmp === 'object' && !parsed.has(tmp)) {
            parsed.add(tmp);
            output[key] = $.call(output, key, revive(input, refs, parsed, tmp, $));
          } else {
            output[key] = $.call(output, key, tmp);
          }
        } else
          output[key] = $.call(output, key, value);
        return output;
      },
      output
    );
  }

  function set(known, input, value) {
    var index = Primitive(input.push(value) - 1);
    known.set(value, index);
    return index;
  }

  function setRefs(known, refs, value) {
    var after;

    switch (typeof value) {
      case 'undefined':
        after = REF_PREFIX.undefined;
        break;
      case 'number':
        if (!Number.isFinite(value)) {
          after = REF_PREFIX.number + REF_SEPARATOR + Primitive(value);
        }
        break;
      case 'bigint':
        after = REF_PREFIX.bigint + REF_SEPARATOR + Primitive(value);
        break;
      case 'symbol':
        var description = Primitive(value);

        after = REF_PREFIX.symbol + REF_SEPARATOR + description.substring(7, description.length - 1);
        break;
      case 'object':
        if (value instanceof RegExp) {
          after = REF_PREFIX.RegExp + REF_SEPARATOR + Primitive(value);
        }
        else if (value instanceof Map) {
          var m = [];
          for (var i of value.entries()) {
            m.push(i);
          }
          after = REF_PREFIX.Map + REF_SEPARATOR + TJS.stringify(m);
        }
        else if (value instanceof Set) {
          var s = [];
          for (var i of value.values()) {
            s.push(i);
          }
          after = REF_PREFIX.Set + REF_SEPARATOR + TJS.stringify(s);
        }
        break;
    }

    if (!after) {
      return;
    }

    var index = known.get(after);

    if (index) {
      return index;
    }

    index = REF_KEY_PREFIX + Primitive(refs.push(after) - 1);
    known.set(after, index);
    return index;
  }

  // the two kinds of primitives
  //  1. the real one
  //  2. the wrapped one

  function primitives(value) {
    return value instanceof Primitive ? Primitive(value) : value;
  }

  function Primitives(key, value) {
    return typeof value === primitive ? new Primitive(value) : value;
  }

}(String, 'string'));
