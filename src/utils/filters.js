import Vue from 'vue'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'

TimeAgo.addDefaultLocale(en)

export default function setupFilters() {
  const timeAgo = new TimeAgo('en')

  Vue.filter("usd", function (value, precision = 2) {
    if (value == null) return null;
    return "$ " + value.toLocaleString(
        undefined, // use the visitor's browser
        { minimumFractionDigits: 2,
          maximumFractionDigits: precision }
    );
  });

  Vue.filter("usd-precise", function (value) {
    if (value == null) return null;
    return "$" + value.toFixed(12);
  });

  Vue.filter("avax", function (value, precision = 2) {
    if (value == null) return null;
    return value.toFixed(precision);
  });

  Vue.filter("full", function (value, avaxPrice) {
    if (value == null) return null;
    let usd = value * avaxPrice;
    return value.toFixed(2) + " AVAX ($" + usd.toFixed(2) + ")";
  });

  Vue.filter("units", function (value) {
    if (value == null) return null;
    return value.toPrecision(3);
  });

  Vue.filter("percent", function (value) {
    if (value == null) return null;
    return (value > 1 ? (value * 100).toFixed(2) : (value * 100).toPrecision(3))  + "%";
  });

  Vue.filter("tx", function (value, short) {
    if (value == null) return null;
    if (short) {
      return value.substr(0, 3) + "..." + value.substr(value.length - 2);
    } else {
      return value.substr(0, 6) + "..." + value.substr(value.length - 4);
    }
  });

  Vue.filter("date", function (value) {
    return timeAgo.format(value.getTime());
  });
}
