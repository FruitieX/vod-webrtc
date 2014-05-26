var debugCharts = function (dataCallback) {
	$(document).ready(function() {
		Highcharts.setOptions({
			global: {
				useUTC: false
			}
		});

		var chart;
		$('#container').highcharts({
			chart: {
				type: 'spline',
				animation: false,
				marginRight: 10,
				events: {
					load: function() {

						// set up the updating of the chart each second
						var series0 = this.series[0];
						var series1 = this.series[1];
						var series2 = this.series[2];

						setInterval(function() {
							var x, y;
							var data = dataCallback();

							x = (new Date()).getTime(), // current time
							y = data[0];

							series0.addPoint([x, y], false, true);

							y = data[1];

							series1.addPoint([x, y], false, true);

							y = data[2];

							series2.addPoint([x, y], true, true);
						}, 1000);
					}
				}
			},
			title: {
				text: 'Statistics'
			},
			xAxis: {
				type: 'datetime',
				tickPixelInterval: 150
			},
			yAxis: {
				title: {
					text: 'Bytes / sec'
				},
				plotLines: [{
					value: 0,
					width: 3,
					color: '#808080'
				}],
				min: 0
			},
			plotOptions: {
				spline: {
					lineWidth: 2,
					marker: {
						enabled: false
					}
				},
			},
			tooltip: {
				enabled: false
			},
			legend: {
				enabled: true
			},
			exporting: {
				enabled: false
			},
			series: [{
				name: 'xhrDownload',
				data: (function() {
					// generate an array of random data
					var data = [],
						time = (new Date()).getTime(),
						i;

					for (i = -50; i <= 0; i++) {
						data.push({
							x: time + i * 1000,
							y: 0
						});
					}
					return data;
				})()
			}, {
				name: 'rtcDownload',
				data: (function() {
					// generate an array of random data
					var data = [],
						time = (new Date()).getTime(),
						i;

					for (i = -50; i <= 0; i++) {
						data.push({
							x: time + i * 1000,
							y: 0
						});
					}
					return data;
				})()
			}, {
				name: 'rtcUpload',
				data: (function() {
					// generate an array of random data
					var data = [],
						time = (new Date()).getTime(),
						i;

					for (i = -50; i <= 0; i++) {
						data.push({
							x: time + i * 1000,
							y: 0
						});
					}
					return data;
				})()
			}]
		});
	});
};
