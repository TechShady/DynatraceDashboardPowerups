var DashboardPowerups = (function () {
    const GRID_SELECTOR = '[uitestid="gwt-debug-dashboardGrid"], .grid-dashboard';
    const TITLE_SELECTOR = '[uitestid="gwt-debug-title"]';
    const VAL_SELECTOR = '[uitestid="gwt-debug-custom-chart-single-value-formatted-value"] > span:first-of-type, [uitestid="gwt-debug-kpiValue"] > span:first-of-type';
    const TILE_SELECTOR = '.grid-tile';
    const LEGEND_SELECTOR = '[uitestid="gwt-debug-legend"]';
    const MARKDOWN_SELECTOR = '[uitestid="gwt-debug-MARKDOWN"] > div:first-child > div:first-child';
    const BIGNUM_SELECTOR = '[uitestid="gwt-debug-custom-chart-single-value-formatted-value"] span, [uitestid="gwt-debug-kpiValue"] span';
    const TREND_SELECTOR = '[uitestid="gwt-debug-trendLabel"]';
    const MAP_SELECTOR = '[uitestid="gwt-debug-map"]';
    const MAPTITLE_SELECTOR = 'span[uitestid="gwt-debug-WorldMapTile"]';
    const TABLE_SELECTOR = '[uitestid="gwt-debug-tablePanel"]';
    const TABLE_COL_SELECTOR = '[uitestid="gwt-debug-tablePanel"] > div > div';
    const BANNER_SELECTOR = '[uitestid="gwt-debug-dashboardNameLabel"]';
    const TAG_SELECTOR = '[uitestid="gwt-debug-showMoreTags"] ~ [title]';
    const FUNNEL_SELECTOR = '[uitestid="gwt-debug-funnelPanel"]';
    const SVT_PANEL_SELECTOR = '[uitestid="gwt-debug-chartPanel"]';
    const SVT_METRIC_SELECTOR = '[uitestid="gwt-debug-custom-chart-single-value-title"]';
    const SVT_UNITS_SELECTOR = '[uitestid="gwt-debug-custom-chart-single-value-formatted-value"] > span:nth-of-type(2), [uitestid="gwt-debug-kpiValue"] > span:nth-of-type(2)';
    const PU_COLOR = '!PU(color):';
    const PU_SVG = '!PU(svg):';
    const PU_MAP = '!PU(map):';
    const PU_LINK = '!PU(link):';
    const PU_BANNER = '!PU(banner):';
    const PU_LINE = '!PU(line):';
    const PU_USQLSTACK = '!PU(usqlstack):'; //TODO: add color schemes
    const PU_HEATMAP = '!PU(heatmap):';
    const PU_SANKEY = '!PU(sankey):';
    const PU_FUNNEL = '!PU(funnel):';
    const PU_MATH = '!PU(math):';
    const PU_DATE = '!PU(date):';
    const PU_GAUGE = '!PU(gauge):';

    const USQL_URL = `ui/user-sessions/query?sessionquery=`;
    const MARKERS = [PU_COLOR, PU_SVG, PU_LINK, PU_MAP, PU_BANNER, PU_LINE, PU_USQLSTACK, PU_HEATMAP,
        PU_FUNNEL, PU_SANKEY, PU_MATH, PU_DATE, PU_GAUGE
    ];
    const CHART_OPTS = {
        plotBackgroundColor: '#454646',
    }
    const SERIES_OPTS = {
        "animation": false,
        "allowPointSelect": true,
        cursor: 'crosshair',
        "enableMouseTracking": true,
        stickyTracking: true,
        "states": {
            "hover": {
                "enabled": true,
                "halo": {
                    "opacity": 0.25,
                    "size": 10
                }
            }
        },
    };
    const TOOLTIP_OPTS = {
        enabled: true,
        animation: false,
        outside: true,
        useHTML: true,
        hideDelay: 100,
        shared: true,
        formatter: function () {
            if (typeof (this.points) == "undefined") return;
            return this.points.reduce(function (s, point) {
                let n = point.series.name;
                let i = n.indexOf('¦') || "APPLICATION-0000000000000000".length;
                let sn = n.substring(0, i) || "";

                let $container = $(point.series.chart.container);
                let color = point.series.color;
                let $legend = $container.parents(TILE_SELECTOR).find(LEGEND_SELECTOR);
                if ($legend.length) {
                    let series_index = point.series.index;
                    //let series_name = $legend.children(`.gwt-HTML:nth-child(${series_index + 1})`).text();
                    let series_name = $legend.find(`svg[fill='${color}']`).parents(".gwt-HTML").text();
                    if (series_name.length) sn = series_name;
                }

                let y = Number(point.y);
                if (Number.isNaN(y)) y = point.y; //Isn't a number, keep what we had
                else y = y.toLocaleString(undefined, { maximumFractionDigits: 2 });

                let tip = s + //s gives the category for first series' point, blank otherwise
                    `<div class="powerupLineTooltip">
                    <div class="dot" style="color: ${point.color}; background:${contrast(color)}">● </div>
                    <div>${sn}:</div>
                    <div class="spacer"></div>
                    <div>${y}</div>
                </div>`;

                return tip;
            }, '<b>' + Highcharts.dateFormat("%H:%M", this.x) + '</b>');
        },
    };
    const PIE_TOOLTIP_OPTS = {
        enabled: true,
        animation: false,
        outside: true,
        useHTML: true,
        hideDelay: 100,
        shared: true,
        formatter: undefined,
        pointFormat: `<span style="color:{point.color}">●</span>: <b>{point.percentage:.1f}%</b><br/>`
    }
    const PIE_SERIES_OPTS = {
        "animation": false,
        "allowPointSelect": true,
        cursor: 'crosshair',
        "enableMouseTracking": true,
        stickyTracking: true,
        tooltip: PIE_TOOLTIP_OPTS,
        "states": {
            "hover": {
                "enabled": true,
                "halo": {
                    "opacity": 0.25,
                    "size": 3
                }
            }
        },
    };
    const AXIS_OPTS = {
        crosshair: {
            color: '#cccccc',
            width: '1px'
        }
    };
    const MO_CONFIG = { attributes: true, childList: true, subtree: true }; //MutexObserver
    var waits = 0;
    var observers = [];
    var targets = [];
    var dataTables = [];
    var D3MutexBlocking = false;


    //Private methods
    const debounce = (func, wait) => {
        let timeout;

        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const debounceMutex = (fn, mutex, time) => {
        let timeout;

        return function () {
            const functionCall = () => {
                let p = fn.apply(this, arguments);
                //$.when(p).done(() => { mutex = false; })
            }

            clearTimeout(timeout); //new fn trigger came in, throw away old and start waiting again
            if (!mutex.blocking) {
                timeout = setTimeout(functionCall, time);
            } else {
                //already running, throw it away
            }
        }
    }

    const contrast = (color) => {
        let c = d3.rgb(color);
        let L = (0.2126 * c.r) / 255 + (0.7152 * c.g) / 255 + (0.0722 * c.b) / 255;
        if ((L + 0.05) / (0.0 + 0.05) > (1.0 + 0.05) / (L + 0.05))
            return "black";
        else
            return "white";
    }

    const clearPowerup = (e) => {
        if (!pub.PUHighchartsMutex.blocked) {
            let chart = e.target;
            chart.poweredup = false;
        }
    }

    const waitForHCmod = (mod, fn, retries = 5) => {
        if (retries < 1) {
            console.log(`POWERUP: CRITICAL - failed to load Highcharts module ${mod}`);
            return;
        }
        if (mod in Highcharts.seriesTypes) fn();
        else
            setTimeout(() => { waitForHCmod(mod, fn, retries - 1); }, 100);
    }



    //Public methods
    var pub = {};

    pub.POWERUP_EXT_URL = "";
    pub.SVGLib = () => { return pub.POWERUP_EXT_URL + encodeURI(`3rdParty/node_modules/@dynatrace/barista-icons/`); };
    pub.config = {};
    pub.PUHighchartsMutex = { blocking: false, blocked: 0 }; //must be obj to ensure passby ref
    pub.PUHighchartsStatus = () => { return Highcharts.charts.filter(x => typeof (x) !== "undefined").map(x => x.poweredup); }
    pub.SVGInject = (obj, attempts = 5) => {
        if (typeof (SVGInject) == "undefined") {
            if (attempts < 1) return false;
            setTimeout(() => { pub.SVGInject(obj, attempts - 1); }, 100);
        } else {
            SVGInject(obj);
        }
    }

    pub.PUHighcharts = function () {
        function wrapExporting() {
            Highcharts.wrap(Highcharts.Chart.prototype, 'contextMenu', function (proceed) { //Highcharts bug fix, https://github.com/highcharts/highcharts/issues/9800
                proceed.apply(this, Array.prototype.slice.call(arguments, 1));

                if (typeof (this.exportContextMenu.style.originalTop) == "undefined") {
                    // Correct for chart position
                    var pos = Highcharts.offset(this.container);
                    var defaultPadding = 5 * 2;
                    this.exportContextMenu.style.top = (parseInt(this.exportContextMenu.style.top) + pos.top) + 'px';
                    this.exportContextMenu.style.left = (pos.left + this.chartWidth - this.exportMenuWidth - parseInt(this.exportContextMenu.style.padding) - defaultPadding) + 'px';
                    this.exportContextMenu.style.width = this.exportMenuWidth + 'px';

                    //safe store
                    this.exportContextMenu.style.originalTop = this.exportContextMenu.style.top;

                    // Move it to the body
                    Highcharts.doc.body.appendChild(this.exportContextMenu);
                    this.exportContextMenu.poweredup = true;
                } else {
                    var pos = Highcharts.offset(this.container);
                    var defaultPadding = 5 * 2;
                    this.exportContextMenu.style.top = this.exportContextMenu.style.originalTop;
                }
            });
        }

        //be sure not to leak off dashboards
        if (window.location.hash.startsWith("#dashboard;") ||
            window.location.hash.startsWith("#dashboard/dashboard;")) {
            if (pub.PUHighchartsMutex.blocking) {
                pub.PUHighchartsMutex.blocked++;
                if (pub.PUHighchartsMutex.blocked % 100 == 0) {
                    console.log("Powerup: WARN - PUHighcharts mutex blocked, skipped " + pub.PUHighchartsMutex.blocked);
                }
                return false;
            } else {
                pub.PUHighchartsMutex.blocking = true;
            }
            if (pub.config.Powerups.debug) console.log("Powerup: powering-up Highcharts...");
            let PUcount = 0;
            let promises = [];
            let mainPromise = new $.Deferred();
            wrapExporting();
            Highcharts.charts
                .filter(x => typeof (x) != "undefined")
                //.filter(x => !x.poweredup)
                .filter(x => typeof (x.container) != "undefined")
                .filter(x => x.options.type != 'sankey' && x.options.type != 'heatmap')
                .forEach(chart => {
                    let p = pub.PUHighchart(chart);
                    promises.push(p);
                    $.when(p).done(val => { if (val) PUcount++; });
                });
            $.when.apply($, promises).then(function () {
                $(".highcharts-container").css("z-index", 999);
                if (pub.config.Powerups.debug) console.log("Powerup: " + PUcount + " Highcharts powered-up.");
                //other dashboard powering-up here
                //pub.fireAllPowerUps(true); //don't think this is needed anymore, thanks to MO

                mainPromise.resolve(true);
                pub.PUHighchartsMutex.blocking = false;
                pub.PUHighchartsMutex.blocked = 0;
            });
            return mainPromise;
        } else {
            if (pub.config.Powerups.debug) console.log("Powerup: no longer on a dashboard, removing PUHighcharts listener...");
            Highcharts.removeEvent(Highcharts.Chart, 'load', pub.PUHighcharts);
            return false;
        }
    }

    pub.PUHighchart = function (chart) {
        let pu = false;
        var EXPORT_OPTS = {
            enabled: true,
            fallbackToExportServer: true,
            libURL: pub.POWERUP_EXT_URL + '3rdParty/Highcharts/lib',
            buttons: {
                contextButton: {
                    //    ["printChart", "separator", "downloadPNG", "downloadJPEG", "downloadPDF", "downloadSVG", "separator", "downloadCSV", "downloadXLS", "viewData", "openInCloud"]
                    menuItems: ["downloadSVG", "downloadPDF", "separator", "downloadCSV", "downloadXLS", "printChart"]
                }
            }
        }
        const compare = function (optsNew, optsCurrent) {
            //Loop through properties in new options, looking for 1-way equivalency
            for (var p in optsNew) {
                //Check property exists on both objects
                if (optsNew.hasOwnProperty(p) !== optsCurrent.hasOwnProperty(p)) return false;

                switch (typeof (optsNew[p])) {
                    //Deep compare objects
                    case 'object':
                        if (!compare(optsNew[p], optsCurrent[p])) return false;
                        break;
                    //Compare function code
                    case 'function':
                        if (typeof (optsCurrent[p]) == 'undefined' || (p != 'compare' && optsNew[p].toString() != optsCurrent[p].toString())) return false;
                        break;
                    //Compare values
                    default:
                        if (optsNew[p] != optsCurrent[p]) return false;
                }
            }
            return true;
        }

        const enableExporting = function () {
            let $container = $(chart.container);

            if (!compare(EXPORT_OPTS, chart.options.exporting)) { //enable exporting
                //if bigger than XYZ, allow
                chart.update({ exporting: EXPORT_OPTS }, false);
                pu = true;
            }
            $container //enable exporting
                .off("mouseenter.powerup")
                .on("mouseenter.powerup", (e) => {
                    $container.find(".highcharts-exporting-group").addClass("powerupVisible");
                })
                .off("mouseleave.powerup")
                .on("mouseleave.powerup", (e) => {
                    $container.find(".highcharts-exporting-group").removeClass("powerupVisible");
                });
        }

        const restoreHandlers = function () {
            let $container = $(chart.container);
            //try to restore normal chart interactions, preventing navigation from plot
            $container.find(".highcharts-plot-background")
                .off("touchstart.powerup")
                .on("touchstart.powerup", (e) => {
                    chart.pointer.onContainerTouchStart(e);
                    e.stopImmediatePropagation();
                })
                .off("touchmove.powerup")
                .on("touchmove.powerup", (e) => {
                    chart.pointer.onContainerTouchMove(e);
                    e.stopImmediatePropagation();
                })
                .off("click.powerup")
                .on("click.powerup", (e) => {
                    console.log("Powerup: clicked plot background");
                    e.stopImmediatePropagation();
                })
                .addClass("powerupPlotBackground"); //change cursor
        }

        var lineChartPU = function () {
            let $container = $(chart.container);

            chart.series.forEach(series => {
                if (!compare(SERIES_OPTS, series.options)) {
                    series.update(SERIES_OPTS, false);
                    pu = true;
                }
            });
            if (!compare(CHART_OPTS, chart.options.chart)) {
                chart.update({ chart: CHART_OPTS }, false);
                pu = true;
            }
            if (!compare(TOOLTIP_OPTS, chart.tooltip.options)) {
                chart.update({ tooltip: TOOLTIP_OPTS }, false);
                pu = true;
            }
            if (!compare(AXIS_OPTS, chart.xAxis[0].options)) {
                chart.update({ xAxis: AXIS_OPTS }, false);
                pu = true;
            }
            if (!compare(AXIS_OPTS, chart.yAxis[0].options)) {
                chart.update({ yAxis: AXIS_OPTS }, false);
                pu = true;
            }
            restoreHandlers();
        }

        var pieChartPU = function () {
            chart.series.forEach(series => {
                if (!compare(PIE_SERIES_OPTS, series.options)) {
                    series.update(PIE_SERIES_OPTS, false);
                    pu = true;
                }
            });
            /*if (!compare(CHART_OPTS, chart.options.chart)) {
                chart.update({ chart: CHART_OPTS }, false);
                pu = true;
            }*/
            /*if (!compare(PIE_TOOLTIP_OPTS, chart.series[0].tooltipOptions)) {
                chart.series[0].update({ tooltipOptions: PIE_TOOLTIP_OPTS }, true);
                pu = true;
            }*/
            /*if (!compare(AXIS_OPTS, chart.xAxis[0].options)) {
                chart.update({ xAxis: AXIS_OPTS }, false);
                pu = true;
            }
            if (!compare(AXIS_OPTS, chart.yAxis[0].options)) {
                chart.update({ yAxis: AXIS_OPTS }, false);
                pu = true;
            }*/
            restoreHandlers();
        }

        if (pub.config.Powerups.tooltipPU &&
            typeof (chart) !== "undefined" &&
            //!chart.poweredup &&
            typeof (chart.container) != "undefined") {
            let mainPromise = new $.Deferred();
            let promises = [];

            let $container = $(chart.container);
            let $tile = $container.parents(TILE_SELECTOR);
            let $title = $tile.find(TITLE_SELECTOR);
            let title = $title.text();
            if (title.includes(PU_LINE)) {
                if (pub.PULine(chart, title)) {
                    pu = true;
                    lineChartPU();
                    enableExporting();
                }
            } else if (title.includes(PU_USQLSTACK)) {
                let p = pub.PUUsqlStack(chart, title);
                promises.push(p);
                $.when(p).done(val => {
                    restoreHandlers();
                    enableExporting();
                    if (val) pu = true;
                })
            } else if (title.includes(PU_HEATMAP)) {
                /*if ($(chart.container).is(":visible")) {
                    if (pub.PUHeatmap(chart, title))
                        pu = true;
                } else {
                    if (pub.PUHeatmap(chart, title, $("#heatmap").get(0)))
                        pu = true;
                }*/
                if (pub.PUHeatmap(chart, title, chart.newContainer))
                    pu = true;
            } else if (title.includes(PU_GAUGE)) {
                let p = pub.puGauge(chart, title);
                promises.push(p);
                $.when(p).done(val => {
                    //restoreHandlers();
                    //enableExporting();
                    if (val) pu = true;
                })
            } else if(chart.series[0].type =="pie") {
                pieChartPU();
            } else {
                lineChartPU();
                enableExporting();
            }


            $.when.apply($, promises).then(() => {
                if (pu) {
                    try {
                        if (Object.keys(chart).length) {
                            //Highcharts Heatmap bug workaround
                            if ("heatmap" in Highcharts.seriesTypes &&
                                typeof (chart.colorAxis) === "undefined")
                                chart.colorAxis = [];
                            chart.redraw(false);
                        } else {
                            console.log("Powerup: DEBUG - ignoring empty chart");
                        }
                    } catch (e) {
                        console.log("Powerup: CRITICAL - failed to redraw, error:");
                        console.log(e);
                        console.log(chart);
                    }
                }
                mainPromise.resolve(true);
            });
            return mainPromise;
        } else {
            return false;
        }
    }

    pub.PULine = function (chart, title) { //example: !PU(line):thld=4000;hcol=green;lcol=red
        if (!pub.config.Powerups.linePU) return;
        let titletokens = title.split(PU_LINE);
        let argstring = titletokens[1];
        let args = argstring.split(";").map(x => x.split("="));
        if (args.length < 3) {
            if (pub.config.Powerups.debug)
                console.log("Powerup: ERROR - invalid argstring: " + argstring);
            return false;
        }
        let thld = args.find(x => x[0] == "thld")[1];
        let hcol = args.find(x => x[0] == "hcol")[1];
        let lcol = args.find(x => x[0] == "lcol")[1];

        let series_opts = {
            threshold: thld,
            negativeColor: lcol,
            color: hcol
        }

        chart.series[0].update(series_opts);
        chart.yAxis[0].addPlotLine({
            value: thld,
            color: 'yellow',
            width: 1
        });

        //chart.poweredup = true;
        return true;
    }

    pub.PUUsqlStack = function (chart, title, retries = 3) { //example: !PU(usqlstack):colors=green,yellow,red
        if (!pub.config.Powerups.usqlstackPU) return false;
        let p = new $.Deferred();
        let titletokens = title.split(PU_USQLSTACK);
        let argstring = titletokens[1];
        let args = argstring.split(";").map(x => x.split("="));
        if (args.length < 1) {
            if (pub.config.Powerups.debug)
                console.log("Powerup: ERROR - invalid argstring: " + argstring);
            return false;
        }
        let colors = ((args.find(x => x[0] == "colors") || [])[1]);
        if (colors) colors = colors.split(',');

        //get data
        if (chart.series.length > 1) { //magically the data is actually already split, just stack it
            chart.series.forEach((s, i) => {
                let opts = {
                    stacking: "normal",
                    groupPadding: 0
                }
                if (colors && Array.isArray(colors) && colors[i])
                    opts.color = colors[i];
                s.update(opts, false);
            });
            chart.redraw(false);
            return true;
        } else if (chart.series.length < 1) { //something's broken, just abort
            console.log("Powerup: WARN - USQLStack did not find a series, aborting.");
            return false;
        }


        if (!chart.series[0].data.length) {//no data, try 3 more times then quit
            if (retries) {
                setTimeout(() => {
                    let p0 = pub.PUUsqlStack(chart, title, retries - 1);
                    $.when(p0).done((d0) => { p.resolve(d0); })
                }, 50);
                return p;
            } else return false;
        }
        if (!chart.series[0].data[0].name.includes(',')) return false; //if there's no splitting, quit
        let splittings = [];
        let newSeries = [];
        let newCategories = [];

        chart.series[0].data.forEach((d) => {
            let nameArr = d.name.split(',');
            let newName = nameArr[0];
            let split = nameArr[1].trim();
            let i = splittings.findIndex((x) => x == split);
            if (i < 0) {
                splittings.push(split);
                let newSerie = {
                    name: chart.series[0].name + `(${split})`,
                    type: 'bar',
                    cursor: 'crosshair',
                    stacking: 'normal',
                    data: [
                        {
                            name: newName,
                            x: 0,
                            y: d.y
                        }
                    ]
                }
                let seriesNum = newSeries.length;
                if (colors && Array.isArray(colors) && colors[seriesNum])
                    newSerie.color = colors[seriesNum];
                newSeries.push(newSerie);
            } else {
                newSeries[i].data.push({
                    name: newName,
                    x: newSeries[i].data.length,
                    y: d.y
                });
            }
            if (newCategories.findIndex(x => x == newName) < 0)
                newCategories.push(newName);
        });

        chart.series[0].remove(false, false);
        chart.axes[0].setCategories(newCategories, false);
        newSeries.forEach((ns, idx) => {
            chart.addSeries(ns, false, false);
            //chart.series[idx].setData(ns.data);
        });


        chart.update({ chart: CHART_OPTS }, false);

        chart.redraw(false);
        //chart.poweredup = true;
        $(".highcharts-exporting-group").addClass("powerupVisible");
        p.resolve(true);
        return p;
    }

    /*pub.addPUHighchartsListener = function () {
        if (pub.config.Powerups.debug) console.log("Powerup: added PUHighcharts listener");
        Highcharts.addEvent(Highcharts.Chart, 'load', debounceMutex(pub.PUHighcharts, pub.PUHighchartsMutex, 200));
        Highcharts.addEvent(Highcharts.Chart, 'redraw', debounceMutex(pub.PUHighcharts, pub.PUHighchartsMutex, 200));
        Highcharts.addEvent(Highcharts.Chart, 'redraw', clearPowerup);
        pub.PUHighcharts();
        PUwatchdog();
    
        /*
            custom charts are destroyed and loaded on new data, fires load event
            usql charts are redrawn on new data, fires redraw event
    
            listen for either event and begin powering-up
            we will get several of these events, so need to debounce
                start a timer
                throw away all but last event until timer expires
    
            at the end of powering-up, we must redraw the chart(s) ourselves, which again fires redraw
                handle by using a crude mutex
                if mutex == true, we're already powering-up, abort
                else set mutex=true and power-up
                when done set mutex=false
    
        */
    //}

    pub.highlightPointsInOtherCharts = function (e) {
        if (!pub.config.Powerups.tooltipPU) return;

        const container = e.currentTarget;
        const charts = Highcharts.charts
            .filter(x => typeof (x) != "undefined")
            .filter(x => x.options.type != 'sankey' && x.options.type != 'heatmap');
        const chartIndex = charts.findIndex(chart => chart.container === container);

        if (chartIndex > -1) {
            const chart = charts[chartIndex];

            const event = chart.pointer.normalize(e.originalEvent); // Find coordinates within the chart
            var point;
            chart.series.forEach((s, i) => { // Get the hovered point
                if (!point)
                    point = s.searchPoint(event, true);
            });

            if (point && point.series && point.series.xAxis && point.series.yAxis) { //prevent errors if something doesn't exist
                const x = point.x;

                for (let i = 0; i < charts.length; i++) {
                    if (i != chartIndex) {
                        for (let s = 0; s < charts[i].series.length; s++) {
                            const points = charts[i].series[s].points;
                            for (let p = 0; p < points.length; p++) {
                                if (points[p].x === x) {
                                    //points[p].onMouseOver();
                                    points[p].series.xAxis.drawCrosshair(undefined, points[p]);
                                    points[p].series.yAxis.drawCrosshair(undefined, points[p]);
                                    break;
                                }
                            }
                        }

                    } else { //no need to anything on current chart

                    }
                }
            }
        }
    }

    pub.removeHighlightPointsInOtherCharts = function (e) {
        const charts = Highcharts.charts.filter(x => typeof (x) != "undefined");
        for (let i = 0; i < charts.length; i++) {
            charts[i].xAxis[0].hideCrosshair();
        }
    }

    pub.loadChartSync = function () {
        $('[uitestid="gwt-debug-dashboardGrid"]').off("mouseover", ".highcharts-container");
        $('[uitestid="gwt-debug-dashboardGrid"]').off("mouseout", ".highcharts-container");

        $('[uitestid="gwt-debug-dashboardGrid"]').on("mouseover", ".highcharts-container", debounce(pub.highlightPointsInOtherCharts, 50));
        $('[uitestid="gwt-debug-dashboardGrid"]').on("mouseout", ".highcharts-container", pub.removeHighlightPointsInOtherCharts);
    }

    pub.cleanMarkup = function () {
        let p = new $.Deferred();
        if (pub.config.Powerups.debug) console.log("Powerup: DEBUG - clean power-up markup");
        $(TITLE_SELECTOR).each((i, el) => {
            let $title = $(el);
            if ($title.children('.powerup-markup').length) return true; //already done
            let title = $title.text();
            let idx = title.length;

            idx = MARKERS.reduce((acc, marker) =>
                (title.includes(marker) ?
                    Math.min(title.indexOf(marker), acc) :
                    Math.min(acc, idx))
                , idx);

            let newTitle = title.substring(0, idx) +
                `<span class="powerup-markup">` +
                title.substring(idx) +
                `</span>`;

            if (idx < title.length)
                $title.html(newTitle);
        });
        $(TAG_SELECTOR).each((i, el) => {
            let $tag = $(el);
            let title = $tag.attr("title");

            if (title.includes(PU_BANNER)) {
                $tag.hide();
            }
        });
        p.resolve(true);
        return p;
    }

    pub.bannerPowerUp = function () {
        if (!pub.config.Powerups.bannerPU) return;
        let powerupFound = false;
        $(TAG_SELECTOR).each((i, el) => {
            let $tag = $(el);
            let title = $tag.attr("title");

            if (title.includes(PU_BANNER)) {
                let titletokens = title.split(PU_BANNER);
                let argstring = titletokens[1];
                let args = argstring.split(";").map(x => x.split("="));
                let color = args.find(x => x[0] == "color")[1];

                $(BANNER_SELECTOR).css("background", color);
                $(BANNER_SELECTOR).css("color", contrast(color));
                powerupFound = true;
            }
        });

        if (!powerupFound) {
            $(BANNER_SELECTOR).css("background", '');
            $(BANNER_SELECTOR).css("color", '');
        } else {
            if (pub.config.Powerups.debug) console.log("Powerup: DEBUG - banner power-up found");
        }
    }

    pub.colorPowerUp = function () {
        if (!pub.config.Powerups.colorPU) return;
        let class_norm = `powerup-color-normal`;
        let class_warn = `powerup-color-warning`;
        switch (pub.config.Powerups.animateWarning) {
            case "3 Pulses":
                class_warn += "-blink threeBlink";
                break;
            case "Always":
                class_warn += "-blink";
                break;
            case "Never":
            default:
        }
        let class_crit = `powerup-color-critical`;
        switch (pub.config.Powerups.animateCritical) {
            case "Always":
                class_crit += "-blink";
                break;
            case "Never":
                break;
            case "3 Pulses":
            default:
                class_crit += "-blink threeBlink";
        }


        $(TITLE_SELECTOR).each((i, el) => {
            let $title = $(el);
            let $tile = $title.parents(".grid-tile");
            let $bignum = $tile.find(BIGNUM_SELECTOR);

            //Step1: change tile colors
            if ($title.text().includes(PU_COLOR)) { //example !PU(color):base=high;warn=90;crit=70
                if (pub.config.Powerups.debug) console.log("Powerup: color power-up found");
                let titletokens = $title.text().split(PU_COLOR);
                let argstring = titletokens[1];
                let args = argstring.split(";").map(x => x.split("="));
                /*if (args.length < 3) {
                    console.log("Powerup: ERROR - invalid argstring: " + argstring);
                    return false;
                }*/
                let base = (args.find(x => x[0] == "base") || [])[1] || "low";
                let warn = Number(
                    (args.find(x => x[0] == "warn") || [])
                    [1]);
                let crit = Number(
                    (args.find(x => x[0] == "crit") || [])
                    [1]);
                let val = Number(
                    $tile.find(VAL_SELECTOR)
                        .text().replace(/,/g, ''));
                let color = (args.find(x => x[0] == "color") || [])[1];

                let $target = (pub.config.Powerups.colorPUTarget == "Border" ? $tile : $bignum);
                if (!isNaN(warn) && !isNaN(crit)) {

                    $target.removeClass("powerup-color-critical powerup-color-warning powerup-color-normal");
                    $target.removeClass("powerup-color-critical-blink powerup-color-warning-blink threeBlink");
                    if (base == "low") {
                        if (val < warn) $target.addClass(class_norm);
                        else if (val < crit) $target.addClass(class_warn);
                        else $target.addClass(class_crit);
                    } else if (base == "high") {
                        if (val > warn) $target.addClass(class_norm);
                        else if (val > crit) $target.addClass(class_warn);
                        else $target.addClass(class_crit);
                    }

                    let $trend = $tile.find(TREND_SELECTOR);
                    if ($trend.length) {
                        let trend = Number($trend.text().replace(/%/, ''));
                        $trend.removeClass("powerup-color-critical powerup-color-warning powerup-color-normal");
                        if (base == "low") {
                            if (trend > 0) $trend.addClass("powerup-color-warning");
                            else if (trend < 0) $trend.addClass("powerup-color-normal");
                        } else if (base == "high") {
                            if (trend < 0) $trend.addClass("powerup-color-warning");
                            else if (trend > 0) $trend.addClass("powerup-color-normal");
                        }
                    }
                } else if (typeof (color) != "undefined") {
                    $target.css("color", color);
                }
            }
        });
    }

    pub.svgPowerUp = function () {
        if (!pub.config.Powerups.svgPU) return;
        let class_norm = `powerup-svg-normal`;
        let class_warn = `powerup-svg-warning`;
        switch (pub.config.Powerups.animateWarning) {
            case "3 Pulses":
                class_warn += "-blink threeBlink";
                break;
            case "Always":
                class_warn += "-blink";
                break;
            case "Never":
            default:
        }
        let class_crit = `powerup-svg-critical`;
        switch (pub.config.Powerups.animateCritical) {
            case "Always":
                class_crit += "-blink";
                break;
            case "Never":
                break;
            case "3 Pulses":
            default:
                class_crit += "-blink threeBlink";
        }

        $(MARKDOWN_SELECTOR).each((i, el) => {
            let $svgcontainer = $(el);
            let $tile = $svgcontainer.parents(".grid-tile");

            if (!$svgcontainer.text().includes(PU_SVG)) return;
            if (pub.config.Powerups.debug) console.log("Powerup: svg power-up found");
            let argstring = $svgcontainer.text().split(PU_SVG)[1];

            let args = argstring.split(";").map(x => x.split("="));
            let icon = args.find(x => x[0] == "icon")[1];
            let link = args.find(x => x[0] == "link")[1];
            let base = args.find(x => x[0] == "base")[1];
            let warn = Number(args.find(x => x[0] == "warn")[1]);
            let crit = Number(args.find(x => x[0] == "crit")[1]);
            let argObj = {
                icon: icon,
                link: link,
                base: base,
                warn: warn,
                crit: crit
            }
            let val = pub.findLinkedVal(link);

            //swap in the svg
            var imgURL = pub.SVGLib() + encodeURI(`${icon}.svg`);
            fetch(imgURL)
                .then((response) => response.text())
                .then((svgtext) => {
                    $svgcontainer.empty();
                    let $svg = $(svgtext)
                        .attr("data-args", JSON.stringify(argObj))
                        .appendTo($svgcontainer);

                    $svg.removeClass("powerup-svg-critical powerup-svg-warning powerup-svg-normal");
                    $svg.removeClass("powerup-svg-critical-blink powerup-svg-warning-blink threeBlink");
                    if (base == "low") {
                        if (val < warn) $svg.addClass(class_norm);
                        else if (val < crit) $svg.addClass(class_warn);
                        else $svg.addClass(class_crit);
                    } else if (base == "high") {
                        if (val > warn) $svg.addClass(class_norm);
                        else if (val > crit) $svg.addClass(class_warn);
                        else $svg.addClass(class_crit);
                    }
                });

        });
    }

    pub.updateSVGPowerUp = function () {
        if (!pub.config.Powerups.svgPU) return;
        let class_norm = `powerup-svg-normal`;
        let class_warn = `powerup-svg-warning`;
        switch (pub.config.Powerups.animateWarning) {
            case "3 Pulses":
                class_warn += "-blink threeBlink";
                break;
            case "Always":
                class_warn += "-blink";
                break;
            case "Never":
            default:
        }
        let class_crit = `powerup-svg-critical`;
        switch (pub.config.Powerups.animateCritical) {
            case "Always":
                class_crit += "-blink";
                break;
            case "Never":
                break;
            case "3 Pulses":
            default:
                class_crit += "-blink threeBlink";
        }

        $(MARKDOWN_SELECTOR).each((i, el) => {
            let $svgcontainer = $(el);
            let $tile = $svgcontainer.parents(".grid-tile");
            let $svg = $svgcontainer.find("svg:first-of-type");

            if ($svg.length &&
                !$svg.hasClass('highcharts-root')) {
                let args = $svg.attr("data-args") || "{}";
                args = JSON.parse(args);

                let val = pub.findLinkedVal(args.link);

                $svg.removeClass("powerup-svg-critical powerup-svg-warning powerup-svg-normal");
                $svg.removeClass("powerup-svg-critical-blink powerup-svg-warning-blink threeBlink");
                if (args.base == "low") {
                    if (val < args.warn) $svg.addClass(class_norm);
                    else if (val < args.crit) $svg.addClass(class_warn);
                    else $svg.addClass(class_crit);
                } else if (args.base == "high") {
                    if (val > args.warn) $svg.addClass(class_norm);
                    else if (val > args.crit) $svg.addClass(class_warn);
                    else $svg.addClass(class_crit);
                }
            }
        });
    }

    pub.findLinkedVal = function (link) {
        //find val
        let link_text = PU_LINK + link;
        let val;
        $(TITLE_SELECTOR).each((i_link, el_link) => {
            let $linktitle = $(el_link);

            if ($linktitle.text().includes(link_text)) {
                let $linktile = $linktitle.parents(".grid-tile");
                val = Number($linktile.find(VAL_SELECTOR).text().replace(/,/g, ''));
            }
        });
        if (typeof val == "undefined") {
            console.log("Powerup: ERROR - unable to match link: " + link_text);
            return undefined;
        } else {
            return val;
        }
    }

    pub.findLinkedMarkdown = function (link) {
        //find val
        let link_text = PU_LINK + link;
        let tile;
        $(MARKDOWN_SELECTOR).each((i, el) => {
            if ($(el).text().includes(link_text)) {
                tile = el;
            }
        });
        if (typeof tile == "undefined") {
            console.log("Powerup: ERROR - unable to match markdown with link: " + link_text);
            return undefined;
        } else {
            return tile;
        }
    }

    pub.sankeyPowerUp = function () {
        if (!pub.config.Powerups.sankeyPU) return;
        let re = /\/\d+(\/.*)?$/;

        function readTableData(table) {
            let $table = $(table);
            let dataTable = [];
            let touples = [];
            let goals = [];
            let apdexList = [];
            let UAPs = {
                strings: [], //{actionName, key, val, count}
                doubles: [], //{actionName, key, sum, count}
                longs: [], //{actionName, key, sum, count}
                dates: [] //{actionName, key, val, count}
            };

            $table
                .children('div:first-of-type')
                .children('div')
                .each((colIdx, col) => {
                    let $rows = $(col).find('span');
                    let colName = $rows.eq(0).text();
                    let rowCount = $rows.length;
                    if (typeof (dataTable[colIdx]) == "undefined") dataTable[colIdx] = [];

                    $rows.each(function (rowIdx, rowEl) {
                        if (typeof (dataTable[colIdx][rowIdx]) == "undefined") dataTable[colIdx][rowIdx] = [];
                        let row = $(rowEl).text();
                        if (row.substring(0, 1) != '[' || row.substr(-1) != ']') return;
                        let arr = row.substr(1, row.length - 2)
                            .split(',')
                            .map(x => x.trim())
                            .map(x => x.replace(re, '/*$1'));//clean up strings
                        dataTable[colIdx][rowIdx] = arr; //safe-store the dataTable in case we want to manipulate later

                        //TODO: relace colIdx IFs with colNames
                        if (colIdx == 0) for (let k = 0; k < arr.length - 1; k++) { //useraction.name
                            let touple = { from: arr[k], to: arr[k + 1] };
                            if (touple.from === touple.to) continue; // ignore self actions
                            //touple.from = touple.from.replace(re, '/*$1'); 
                            //touple.to = touple.to.replace(re, '/*$1');
                            let l = touples.findIndex(t => t.from === touple.from && t.to === touple.to);
                            if (l < 0) {
                                touple.weight = 1;
                                touples.push(touple);
                            } else {
                                touples[l].weight++;
                            }
                        } else if (colIdx == 1) for (let k = 0; k < arr.length; k++) { //matchingConversion goals
                            if (arr[k] !== "[]") {
                                let actionName = dataTable[0][rowIdx][k];
                                let goalsIdx = goals.findIndex(x => x.actionName == actionName);
                                if (goalsIdx < 0) goals.push({
                                    actionName: actionName,
                                    count: 1,
                                    svg: `<img src='${pub.SVGLib() + 'finishflag.svg'}' onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-white'>`,
                                    goalName: arr[k].substr(1, arr[k].length - 2).trim()
                                });
                                else goals[goalsIdx].count++;
                            }
                        } else if (colIdx == 2) for (let k = 0; k < arr.length; k++) { //apdex
                            let val = arr[k];
                            if (val !== "") {
                                let actionName = dataTable[0][rowIdx][k];
                                let apdexIdx = apdexList.findIndex(x => x.actionName == actionName);

                                if (apdexIdx < 0) {
                                    let apdexObj = { actionName: actionName, satisfied: 0, tolerating: 0, frustrated: 0 };
                                    apdexIdx = apdexList.length;
                                    apdexList.push(apdexObj);
                                }
                                switch (val) {
                                    case 'SATISFIED':
                                        apdexList[apdexIdx].satisfied++;
                                        break;
                                    case 'TOLERATING':
                                        apdexList[apdexIdx].tolerating++;
                                        break;
                                    case 'FRUSTRATED':
                                        apdexList[apdexIdx].frustrated++;
                                        break;
                                }
                            }
                        } else if (colIdx == 3) for (let k = 0; k < arr.length; k++) { //entry actions
                            let val = arr[k];
                            if (val === "true") {
                                let actionName = dataTable[0][rowIdx][k];
                                let apdexIdx = apdexList.findIndex(x => x.actionName == actionName);

                                if (apdexIdx > -1) {
                                    if (!apdexList[apdexIdx].entryAction)
                                        apdexList[apdexIdx].entryAction = true;
                                    apdexList[apdexIdx].entryActionSVG = `<img src='${pub.SVGLib() + 'entry.svg'}'  onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-white'>`;
                                }
                            }
                        }
                        else if (colIdx == 4) for (let k = 0; k < arr.length; k++) { //exit actions
                            let val = arr[k];
                            if (val === "true") {
                                let actionName = dataTable[0][rowIdx][k];
                                let apdexIdx = apdexList.findIndex(x => x.actionName == actionName);

                                if (apdexIdx > -1) {
                                    if (!apdexList[apdexIdx].exitAction)
                                        apdexList[apdexIdx].exitAction = true;
                                    apdexList[apdexIdx].exitActionSVG = `<img src='${pub.SVGLib() + 'exit.svg'}' onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-white'>`;
                                }
                            }
                        } else if (colIdx == 5) { //UAP-String
                            let uapRow;

                            try {
                                uapRow = JSON.parse(row);
                            } catch (e) {
                                console.log("Powerup: Sankey - String: unable to parse JSON");
                            }
                            if (typeof (uapRow) == "undefined") return;

                            uapRow.forEach((uapCol, uapColIdx) => {
                                uapCol.forEach((uapVal, uapValIdx) => {
                                    let actionName = dataTable[0][rowIdx][uapColIdx];
                                    let uapIdx = UAPs.strings.findIndex(x =>
                                        x.actionName == actionName &&
                                        x.key == uapVal.key &&
                                        x.val == uapVal.value
                                    );

                                    if (uapIdx < 0) {
                                        let uapObj = { actionName: actionName, key: uapVal.key, val: uapVal.value, count: 1 };
                                        UAPs.strings.push(uapObj);
                                    } else {
                                        let uap = UAPs.strings[uapIdx];
                                        uap.count++;
                                    }

                                });
                            });
                        } else if (colIdx == 6) { //UAP-Double
                            let uapRow;

                            try {
                                uapRow = JSON.parse(row);
                            } catch (e) {
                                console.log("Powerup: Sankey - String: unable to parse JSON");
                            }
                            if (typeof (uapRow) == "undefined") return;

                            uapRow.forEach((uapCol, uapColIdx) => {
                                uapCol.forEach((uapVal, uapValIdx) => {
                                    let actionName = dataTable[0][rowIdx][uapColIdx];
                                    let uapIdx = UAPs.doubles.findIndex(x =>
                                        x.actionName == actionName &&
                                        x.key == uapVal.key
                                    );
                                    let val = Number(uapVal.value);

                                    if (uapIdx < 0) {
                                        let uapObj = { actionName: actionName, key: uapVal.key, sum: val, count: 1 };
                                        UAPs.doubles.push(uapObj);
                                    } else {
                                        let uap = UAPs.doubles[uapIdx];
                                        uap.count++;
                                        uap.sum += val;
                                    }

                                });
                            });
                        } else if (colIdx == 7) for (let k = 0; k < arr.length; k++) { //UAP-Long
                            let uapRow;

                            try {
                                uapRow = JSON.parse(row);
                            } catch (e) {
                                console.log("Powerup: Sankey - String: unable to parse JSON");
                            }
                            if (typeof (uapRow) == "undefined") return;

                            uapRow.forEach((uapCol, uapColIdx) => {
                                uapCol.forEach((uapVal, uapValIdx) => {
                                    let actionName = dataTable[0][rowIdx][uapColIdx];
                                    let uapIdx = UAPs.longs.findIndex(x =>
                                        x.actionName == actionName &&
                                        x.key == uapVal.key
                                    );
                                    let val = Number(uapVal.value);

                                    if (uapIdx < 0) {
                                        let uapObj = { actionName: actionName, key: uapVal.key, sum: val, count: 1 };
                                        UAPs.longs.push(uapObj);
                                    } else {
                                        let uap = UAPs.longs[uapIdx];
                                        uap.count++;
                                        uap.sum += val;
                                    }

                                });
                            });
                        } else if (colIdx == 8) for (let k = 0; k < arr.length; k++) { //UAP-Date
                            let uapRow;

                            try {
                                uapRow = JSON.parse(row);
                            } catch (e) {
                                console.log("Powerup: Sankey - String: unable to parse JSON");
                            }
                            if (typeof (uapRow) == "undefined") return;

                            uapRow.forEach((uapCol, uapColIdx) => {
                                uapCol.forEach((uapVal, uapValIdx) => {
                                    let actionName = dataTable[0][rowIdx][uapColIdx];
                                    let uapIdx = UAPs.dates.findIndex(x =>
                                        x.actionName == actionName &&
                                        x.key == uapVal.key &&
                                        x.val == uapVal.value
                                    );

                                    if (uapIdx < 0) {
                                        let uapObj = { actionName: actionName, key: uapVal.key, val: uapVal.value, count: 1 };
                                        UAPs.dates.push(uapObj);
                                    } else {
                                        let uap = UAPs.dates[uapIdx];
                                        uap.count++;
                                    }

                                });
                            });
                        }
                    })
                });

            apdexList.forEach((apdex) => {
                if (apdex.satisfied > Math.max(apdex.tolerating, apdex.frustrated)) apdex.svg = `<img src="${pub.SVGLib() + 'smiley-happy-2.svg'}" onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-green'></div>`;
                else if (apdex.tolerating > Math.max(apdex.satisfied, apdex.frustrated)) apdex.svg = `<img src="${pub.SVGLib() + 'smiley-neutral-2.svg'}" onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-yellow'></div>`;
                else if (apdex.frustrated > Math.max(apdex.tolerating, apdex.satisfied)) apdex.svg = `<img src="${pub.SVGLib() + 'smiley-unhappy-2.svg'}" onload="DashboardPowerups.SVGInject(this)" class='powerup-sankey-icon powerup-icon-red'></div>`;
                else apdex.svg = "";
            });
            touples = touples.sort((a, b) => b.weight - a.weight);

            return ({ touples: touples, goals: goals, apdexList: apdexList, UAPs: UAPs });
        }

        function newChart(data, container, params, limit = 20) {
            let options = {
                type: 'sankey',
                title: {
                    text: params.title
                },
                chart: {
                    marginLeft: 100,
                    marginBottom: 200,
                    marginRight: 100
                },
                series: [{
                    data: data.touples.slice(0, limit),
                    type: 'sankey',
                    name: 'UserActions',
                    cursor: 'crosshair',
                    clip: false,
                    dataLabels: {
                        enabled: true,
                        useHTML: true,
                        nodeFormat: '{point.display}',
                        padding: 0
                    },
                    nodes: [],
                    tooltip: {
                        nodeFormat: `<div class="powerup-sankey-tooltip">
                            <b>{point.name}</b><br>
                            UserActions in sample: {point.sum}<br>
                            <u>Apdex</u><br>
                            &nbsp;&nbsp; Satisfied: {point.apdexSatisfied}<br>
                            &nbsp;&nbsp; Tolerating: {point.apdexTolerating}<br>
                            &nbsp;&nbsp; Frustrated: {point.apdexFrustrated}<br>
                            Is entry action: {point.entryAction}<br>
                            Is exit action: {point.exitAction}<br>
                            Goal: {point.conversionGoal}<br>
                            ${uc(params.kpi)}: {point.${params.kpi}}
                            </div>
                        `.trim(),
                        pointFormat: `<div class="powerup-sankey-tooltip">
                        {point.fromNode.name} → {point.toNode.name}: <b>{point.weight}</b><br/>
                        </div>
                        `.trim(),
                        headerFormat: ''
                    }
                }],
                tooltip: {
                    useHTML: true,
                    outside: true,
                    borderWidth: 0,
                    backgroundColor: 'none',
                    shadow: false,
                    className: 'powerup-sankey-tooltip'
                },
                exporting: {
                    enabled: true,
                    fallbackToExportServer: true,
                    libURL: pub.POWERUP_EXT_URL + '3rdParty/Highcharts/lib',
                    buttons: {
                        contextButton: {
                            //    ["printChart", "separator", "downloadPNG", "downloadJPEG", "downloadPDF", "downloadSVG", "separator", "downloadCSV", "downloadXLS", "viewData", "openInCloud"]
                            menuItems: ["downloadSVG", "downloadPDF", "separator", "printChart"]
                        }
                    }
                }
            }

            function uc(str) {
                return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
            }

            data.apdexList.forEach(apdex => {
                let node = {
                    id: apdex.actionName,
                    apdex: apdex,
                    apdexSatisfied: apdex.satisfied.toString(),
                    apdexTolerating: apdex.tolerating.toString(),
                    apdexFrustrated: apdex.frustrated.toString(),
                    entryAction: (apdex.entryAction ? 'true' : 'false'),
                    exitAction: (apdex.exitAction ? 'true' : 'false')
                }

                //Conversion goal handling
                let goal = data.goals.find(x => x.actionName == apdex.actionName);
                if (typeof (goal) != "undefined") {
                    node.goal = goal;
                    node.conversionGoal = goal.goalName;
                } else {
                    node.conversionGoal = 'false';
                }

                //Revenue (UAPs)
                let locale = navigator.language;
                let rev = data.UAPs.doubles.find(x =>
                    x.actionName == apdex.actionName &&
                    x.key == params.kpi);
                let style = { maximumFractionDigits: 2 };
                if (params.kpicurr && params.kpicurr.length)
                    style = { style: 'currency', currency: params.kpicurr };
                if (typeof (rev) != "undefined") {
                    node.revenue = Intl.NumberFormat(locale, style).format(rev.sum);
                } else {
                    node.revenue = Intl.NumberFormat(locale, style).format(0);
                }


                //Node label
                node.display = apdex.svg +
                    (goal ? `<br>${goal.svg}` : "") +
                    (apdex.entryActionSVG ? `<br>${apdex.entryActionSVG}` : '') +
                    (apdex.exitActionSVG ? `<br>${apdex.exitActionSVG}` : '');

                options.series[0].nodes.push(node);
            });

            let chart = Highcharts.chart(container, options, (chart) => {
                let $container = $(container);
                //chart.poweredup = true;
                chart.limit = limit = Math.min(limit, data.touples.length);
                chart.renderer.button('-', 10, 5)
                    .attr({ zIndex: 1100 })
                    .on('click', function () {
                        let newLimit = Math.max(Math.round(chart.limit * .5), 2);
                        chart.destroy();
                        newChart(data, container, params, newLimit);
                    })
                    .add();
                chart.renderer.button('+', 40, 5)
                    .attr({ zIndex: 1100 })
                    .on('click', function () {
                        let newLimit = Math.min(chart.limit * 2, data.touples.length);
                        chart.destroy();
                        newChart(data, container, params, newLimit);
                    })
                    .add();
                chart.renderer.text(`${limit}/${data.touples.length}`, 70, 25)
                    .add();

                $container.find(".highcharts-plot-background")
                    .addClass("powerupPlotBackground");

                $container.find(".highcharts-node")
                    .click(filterPopup);
                $container.find(".highcharts-data-label")
                    .click(filterPopup);


                function filterPopup(e) {
                    let el = e.target;
                    let $el = $(el);
                    let node;
                    if ($el.is(".highcharts-node"))
                        node = chart.series[0].nodes.find(x => x.graphic.element === el);
                    else if ($el.parents(".highcharts-data-label").length)
                        node = chart.series[0].nodes.find(x => x.dataLabel.div === $el.parents(".highcharts-data-label")[0]);
                    else
                        return false;

                    if (typeof (node) === "undefined") return false;
                    let name = node.apdex.actionName;
                    let fmt = Intl.NumberFormat().format;
                    let currFmt = fmt;
                    if (params.kpicurr && params.kpicurr.length) {
                        let locale = navigator.language;
                        let style = { style: 'currency', currency: params.kpicurr };
                        currFmt = Intl.NumberFormat(locale, style).format;
                    }
                    let link = USQL_URL + encodeURIComponent(`SELECT * FROM usersession WHERE useraction.name LIKE "${name}"`);
                    let html = `<p><a href='${link}'><b>${name}</b></a>:</p><ul>`;

                    if (data.UAPs.doubles.length) {
                        html += `<li>Double Properties:<ul>`;
                        data.UAPs.doubles
                            .filter(x => x.actionName === name)
                            .sort((a, b) => {
                                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                                else if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                                else return a.sum - b.sum;
                            })
                            .forEach(x => {
                                let fmter = (x.key === params.kpi ? currFmt : fmt);
                                let sublink = link + encodeURIComponent(` AND useraction.doubleProperties.${x.key} IS NOT NULL`);
                                html += `<li><a href="${sublink}">${x.key}</a>: <ul>`
                                    + `<li>sum: ${fmter(x.sum)}</li>`
                                    + `<li>count: ${fmt(x.count)}</li>`
                                    + `<li>avg: ${fmter(x.sum / x.count)}</li>`
                                    + `</ul></li>`;
                            });
                        html += `</ul></li>` //end double
                    }

                    if (data.UAPs.longs.length) {
                        html += `<li>Long Properties:<ul>`;
                        data.UAPs.longs
                            .filter(x => x.actionName === name)
                            .sort((a, b) => {
                                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                                else if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                                else return a.sum - b.sum;
                            })
                            .forEach(x => {
                                let sublink = link + encodeURIComponent(` AND useraction.longProperties.${x.key} IS NOT NULL`);
                                html += `<li><a href="${sublink}">${x.key}</a>: <ul>`
                                    + `<li>sum: ${fmt(x.sum)}</li>`
                                    + `<li>count: ${fmt(x.count)}</li>`
                                    + `<li>avg: ${fmt(x.sum / x.count)}</li>`
                                    + `</ul></li>`;
                            });
                        html += `</ul></li>` //end long
                    }

                    if (data.UAPs.strings.length) {
                        html += `<li>String Properties:<ul>`;
                        let lastKey, list = "";
                        data.UAPs.strings
                            .filter(x => x.actionName === name)
                            .sort((a, b) => {
                                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                                else if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                                else return b.count - a.count;
                            })
                            .forEach(x => {
                                if (x.key !== lastKey) {
                                    if (list.length) list += `</ul></li>`;
                                    html += list;
                                    let sublink = link + encodeURIComponent(` AND useraction.stringProperties.${x.key} IS NOT NULL`);
                                    list = `<li><a href="${sublink}">${x.key}</a>:<ul>`;
                                }
                                let sublink = link + encodeURIComponent(` AND useraction.stringProperties.${x.key} = "${x.val}"`);
                                list += `<li><a href="${sublink}">${x.val}</a> (${x.count})</li>`;
                                lastKey = x.key;
                            });
                        if (list.length) list += `</ul></li>`;
                        html += list;
                        html += `</ul></li>` //end string
                    }

                    if (data.UAPs.dates.length) {
                        html += `<li>Date Properties:<ul>`;
                        lastKey = ""; list = "";
                        data.UAPs.dates
                            .filter(x => x.actionName === name)
                            .sort((a, b) => {
                                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                                else if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                                else return b.count - a.count;
                            })
                            .forEach(x => {
                                if (x.key !== lastKey) {
                                    if (list.length) list += `</ul></li>`;
                                    html += list;
                                    let sublink = link + encodeURIComponent(` AND useraction.dateProperties.${x.key} IS NOT NULL`);
                                    list = `<li><a href="${sublink}">${x.key}</a>:<ul>`;
                                }
                                let sublink = link + encodeURIComponent(` AND useraction.dateProperties.${x.key} = ${x.val}`);
                                list += `<li><a href="${sublink}">${x.val}</a> (${x.count})</li>`;
                                lastKey = x.key;
                            });
                        if (list.length) list += `</ul></li>`;
                        html += list;
                        html += `</ul></li>` //end date
                    }

                    let $popup = $("<div>")
                        .addClass("powerupSankeyDetailPopup")
                        .html(html)
                        .click(() => { $popup.remove(); })
                        .appendTo(container);
                }
            });

            return chart;
        }

        function findContainer(link) {
            let container, markdown;
            $(MARKDOWN_SELECTOR)
                .each(function (i, el) {
                    let $el = $(el);
                    let text = $el.text();
                    if (!text.includes(PU_LINK)) return;
                    if (text.split(PU_LINK)[1].includes(link))
                        markdown = el;
                });

            if (markdown) { // change behavior here. instead of swapping out the markdown, hide it and add a container div
                let $containers = $(markdown).siblings("[data-highcharts-chart]").children(".highcharts-container");
                $containers.each((i, c) => { //sankey already exists, destroy and recreate later
                    let oldChart = Highcharts.charts
                        .filter(x => typeof (x) !== "undefined")
                        .find(x => x.container === c);
                    container = $(c).parent().get(0);
                    if (oldChart) oldChart.destroy();
                });
                if (!$containers.length) { //hide the markdown, add a container
                    $(markdown).hide();
                    let $c = $("<div>")
                        .addClass("powerupHighchartsContainer")
                        .insertAfter(markdown);
                    container = $c.get(0);
                }
            }
            return container;
        }

        function destroyChartsAndContainers(tile) {
            let $tile = $(tile);
            let $containers = $tile.find(".highcharts-container");

            $containers.each((i, c) => {
                let oldChart = Highcharts.charts
                    .filter(x => typeof (x) !== "undefined")
                    .find(x => x.container === c);
                if (oldChart) oldChart.destory();
                $(c).remove();
            })
        }


        //$(TABLE_SELECTOR)
        $(TITLE_SELECTOR)
            .each(function (i, el) {
                /*let $el = $(el);
                let $tile = $el.parents(TILE_SELECTOR);
                let $title = $tile.find(TITLE_SELECTOR);
                let title = $title.text();
                if (!title.includes(PU_SANKEY)) return;*/
                let $title = $(el);
                let title = $title.text();
                if (!title.includes(PU_SANKEY)) return;
                let $tile = $title.parents(TILE_SELECTOR);
                let $table = $tile.find(TABLE_SELECTOR);

                let argstring = title.split(PU_SANKEY)[1];
                let chartTitle = title.split(PU_SANKEY)[0];
                let args = argstring.split(";").map(x => x.split("="));
                if (args.length < 1) {
                    if (pub.config.Powerups.debug)
                        console.log("Powerup: ERROR - invalid argstring: " + argstring);
                    return false;
                }
                let link = args.find(x => x[0] == "link")[1];
                let kpi = (args.find(x => x[0] == "kpi") || [])[1];
                let kpicurr = (args.find(x => x[0] == "kpicurr") || [])[1];

                let container = findContainer(link);
                if (typeof (container) == "undefined") {
                    console.log("Powerup: WARN - Sankey container is undefined.");
                    return false;
                }
                if (!$table.length) { //USQL error or no data
                    //destroyChartsAndContainers($tile.get(0));
                    return false;
                }

                let data = readTableData($table.get(0));

                let params = {
                    title: chartTitle,
                    kpi: kpi,
                    kpicurr: kpicurr
                };
                let sankey = newChart(data, container, params);
                $(".highcharts-exporting-group").addClass("powerupVisible");
            });
        return true;
    }

    pub.mapPowerUp = function () {
        if (!pub.config.Powerups.worldmapPU) return;


        const callback = function (mutationsList, observer) {
            observer.disconnect(); //stop listening while we make some changes
            setTimeout(() => {
                transformMap(mutationsList, observer);
            }, 50); //Sleep a bit in case there was a lot of mutations

        }

        //Read data from table
        function readTableData(tabletile) {
            let $tabletile = $(tabletile);
            let dataTable = [];
            let normalTable = [];
            let keys = [];
            $tabletile
                .find(TABLE_COL_SELECTOR)
                .each(function (i, el) {
                    let $el = $(el);
                    $el.find('span').each(function (j, el2) {
                        if (typeof (dataTable[i]) == "undefined") dataTable[i] = [];
                        dataTable[i][j] = $(el2).text();
                    });
                });

            let numKeys = dataTable.length;
            let numRows = dataTable[0].length;
            for (let i = 0; i < numKeys; i++) {
                keys.push(dataTable[i].shift());
            }

            for (let i = 0; i < numRows; i++) {
                let obj = {};
                for (let j = 0; j < numKeys; j++) {
                    let key = keys[j];
                    if (j == numKeys - 1 && dataTable[j][i] != null) //Last column should be a number
                        obj[key] = Number(dataTable[j][i].replace(/,/g, ''));
                    else
                        obj[key] = dataTable[j][i] || 0;
                }
                normalTable.push(obj);
            }
            return ({ keys: keys, normalTable: normalTable })
        }

        transformMap = function (mutationsList, observer) {
            if (!pub.config.Powerups.worldmapPU) return;
            let i = observers.findIndex((o) => observer === o);
            let target = targets[i];
            let $target = $(target);
            let d3Target = d3.select(target);
            let $container = $target.parents(MAP_SELECTOR);
            let $tile = $target.parents(TILE_SELECTOR);
            let width = d3Target.attr("width");
            let height = d3Target.attr("height");
            let keys = dataTables[i].keys;
            let valKey = keys[keys.length - 1];
            let normalTable = dataTables[i].normalTable;
            let color = dataTables[i].color;
            let link = dataTables[i].link;
            let newTitle = dataTables[i].newTitle;
            let max = Math.max(1, normalTable.reduce((acc, row) => Math.max(row[valKey], acc), 0));
            let min = Math.max(1, normalTable.reduce((acc, row) => Math.min(row[valKey], acc), 0));
            let scale = d3.scaleLog().domain([min, max]);

            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on("zoom", zoomed);
            d3Target.call(zoom);
            d3Target.selectAll("path").on("click", clicked);
            d3Target.selectAll("path").on("mouseover", hover);
            d3Target.on("click", reset);

            function zoomed() {
                observer.disconnect();
                const { transform } = d3.event;
                let g = d3Target.select("g[transform]");
                g.attr("transform", transform);
                g.attr("stroke-width", 1 / transform.k);
                //console.log("Powerup: map zoom");
                observer.observe(target, MO_CONFIG);  //done zooming, resume observations  
            }

            function clicked(d) {
                //let d3Path = d3.select(this);
                //const [[x0, y0], [x1, y1]] = d3Path.bounds(d);
                let bb = this.getBBox();

                d3.event.stopPropagation();
                d3Target.transition().duration(750).call(
                    zoom.transform,
                    d3.zoomIdentity
                        .translate(width / 2, height / 2)
                        .scale(Math.min(8, 0.9 / Math.max((bb.width) / width, (bb.height) / height)))
                        .translate(-(bb.x + bb.width / 2), -(bb.y + bb.height / 2)),
                    d3.mouse(d3Target.node())
                );
            }

            function reset() {
                d3Target.transition().duration(750).call(
                    zoom.transform,
                    d3.zoomIdentity,
                    d3.zoomTransform(d3Target.node()).invert([width / 2, height / 2])
                );
            }

            function hover() {
                if (!pub.config.Powerups.worldmapPU) return;
                let $tooltip = $tile.find(".powerupMapTooltip");
                let $path = $(this);
                let country = $path.attr("title");
                let code = $path.attr("id").split('-')[1];
                let key = keys[keys.length - 1];
                let countryData = normalTable.find(x => x.country == country);
                let val;
                if (typeof countryData !== "undefined" && typeof (countryData[key]) !== "undefined")
                    val = countryData[key].toLocaleString();
                else
                    val = "0";

                if ($tooltip.length) {
                    let flag = code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
                    $tooltip.find(".geoText").text(`Country: ${country} (${flag})`);
                    $tooltip.find(".valueText").text(`${key}: ${val}`)
                }
            }

            //Prep the SVG
            $target.find(`path`).css("fill", ""); //remove existing coloring
            $container.css("z-index", 999); //bring to front to get hovers

            //Create tooltip
            if (!$tile.find(".powerupMapTooltip").length) {
                let $tooltip = $("<div>")
                    .addClass("powerupMapTooltip")
                    .appendTo($tile);
                let $geoText = $("<div>")
                    .addClass("geoText")
                    .text("Country: ")
                    .appendTo($tooltip);
                let $valueText = $("<div>")
                    .addClass("valueText")
                    .text("Value: ")
                    .appendTo($tooltip);
            }

            //Populate map
            $target.find("path").each(function (i, el) {
                let $el = $(el);
                let country = $el.attr("title");

                let data = normalTable.filter(x => x.country == country);

                $el.attr("data-data", JSON.stringify(data));
                let val = 0;
                if (data.length && data[0][valKey]) {
                    val = data[0][valKey];
                    let pathColor = d3.hsl(color);
                    pathColor.s = color.s * scale(val);
                    $el.css("fill", pathColor.toString());
                }
            });
            let $maptile = $target.parents(TILE_SELECTOR);
            let $maptitle = $maptile.find(MAPTITLE_SELECTOR);
            let maptitle = `World Map (${newTitle})`;
            $maptitle.text(maptitle);

            if (pub.config.Powerups.debug) console.log("Powerup: map powered-up");
            observer.observe(target, MO_CONFIG); //done w/ initial power-up, resume observations
        }

        $(TITLE_SELECTOR).each((i, el) => {
            let $tabletitle = $(el);
            let $tabletile = $tabletitle.parents(TILE_SELECTOR);

            if ($tabletitle.text().includes(PU_MAP)) {
                let titletokens = $tabletitle.text().split(PU_MAP);
                let argstring = titletokens[1];
                let args = argstring.split(";").map(x => x.split("="));
                let color = args.find(x => x[0] == "color")[1] || "green";
                color = d3.hsl(color);
                let link = args.find(x => x[0] == "link")[1];

                // Start observing the target node for configured mutations
                $(MAP_SELECTOR).find(`svg`).each(function (i, map) {
                    let $maptile = $(map).parents(TILE_SELECTOR);
                    let $maptitle = $maptile.find(MAPTITLE_SELECTOR);
                    let maptitle = $maptitle.text();
                    if (maptitle.includes(link) || link == null) {
                        let idx = targets.findIndex(x => x == map);
                        if (idx > -1) {
                            //replace the dataTable
                            let dataTable = readTableData($tabletile);
                            dataTable.color = color;
                            dataTable.link = link;
                            dataTable.newTitle = titletokens[0].trim();
                            dataTables.splice(idx, 1, dataTable);

                            const observer = observers[idx];
                            callback(undefined, observer);
                        } else {
                            //insert the dataTable
                            let dataTable = readTableData($tabletile);
                            dataTable.color = color;
                            dataTable.link = link;
                            dataTable.newTitle = titletokens[0].trim();
                            dataTables.push(dataTable);

                            const observer = new MutationObserver(callback);
                            observer.observe(el, MO_CONFIG);
                            observers.push(observer);
                            targets.push(map);
                            callback(undefined, observer);
                        }
                    }
                });


            }
        });




    };

    pub.PUHeatmap = function (chart, title, newContainer) { //example: !PU(heatmap):vals=.5,.7,.85,.94;names=Unacceptable,Poor,Fair,Good,Excellent;colors=#dc172a,#ef651f,#ffe11c,#6bcb8b,#2ab06f
        if (!pub.config.Powerups.heatmapPU) return;
        if (chart.series.length < 1 || chart.series[0].data.length < 1) return;
        let titletokens = title.split(PU_HEATMAP);
        let argstring = titletokens[1];
        let args = argstring.split(";").map(x => x.split("="));
        let txtColor = (args.find(x => x[0] == "txtColor") || [])[1] || "#ffffff";
        let colorAxis = {};

        if (argstring.includes("vals")) {
            let dataClasses = colorAxis.dataClasses = [];
            let vals = ((args.find(x => x[0] == "vals") || [])[1] || ".5,.7,.85,.94").split(',').map(x => Number(x));
            let names = ((args.find(x => x[0] == "names") || [])[1] || "Unacceptable,Poor,Fair,Good,Excellent").split(',');
            let colors = ((args.find(x => x[0] == "colors") || [])[1] || "#dc172a,#ef651f,#ffe11c,#6bcb8b,#2ab06f").split(',');

            let sorted = !!vals.reduce((n, item) => n !== false && item >= n && item);
            if (!sorted) {
                console.log("Powerup: ERROR - Heatmap PU must have vals sorted ascending");
                return false;
            }

            for (let i = 0; i < vals.length; i++) {
                let obj = {};
                if (i === 0) {
                    obj.to = vals[i];
                    obj.name = names[i];
                    obj.color = colors[i];
                    dataClasses.push(obj);
                    obj = {};
                }

                obj.from = vals[i];
                obj.name = names[i + 1];
                obj.color = colors[i + 1];
                if (i < vals.length - 1) obj.to = vals[i + 1];
                dataClasses.push(obj);
            }
        } else {
            let min = (args.find(x => x[0] == "min") || [])[1];
            let max = (args.find(x => x[0] == "max") || [])[1];
            let minColor = (args.find(x => x[0] == "minColor") || [])[1];
            let maxColor = (args.find(x => x[0] == "maxColor") || [])[1];

            colorAxis = {};
            if (typeof (min) !== "undefined") colorAxis.min = min;
            if (typeof (max) !== "undefined") colorAxis.max = max;
            if (typeof (minColor) !== "undefined") colorAxis.minColor = d3.rgb(minColor).toString();
            if (typeof (maxColor) !== "undefined") colorAxis.maxColor = d3.rgb(maxColor).toString();
        }

        let oldContainer = chart.container;
        let $tile = $(oldContainer).parents(TILE_SELECTOR);
        let $newContainer;
        if (typeof (newContainer) !== "undefined") {
            let oldChart = Highcharts.charts
                .filter(x => typeof (x) !== "undefined")
                .find(x => x.renderTo === newContainer);
            if (oldChart) oldChart.destroy();
            $newContainer = $(newContainer);
        } else {
            $newContainer = $("<div>")
                .addClass("powerupHeatmap")
                .insertAfter(oldContainer);
            newContainer = $newContainer[0];
            chart.newContainer = newContainer;
        }
        let $legend = $tile.find(LEGEND_SELECTOR);

        let newData = [];
        let yNames = [];
        let categories = [];
        function getPointCategoryName(point, dimension) {
            var series = point.series,
                isY = dimension === 'y',
                axis = series[isY ? 'yAxis' : 'xAxis'];
            return axis.categories[point[isY ? 'y' : 'x']];
        }
        chart.series.forEach((s, sIdx) => {
            if (s.type != "column") {
                console.log("Powerup: ERROR - Please use a bar chart as a source for heatmap powerup.");
                return;
            }

            //come up with a better y category
            let series_name = s.name;
            if ($legend.length) {
                let name = $legend.find(`svg[fill='${s.color}']`).parents(".gwt-HTML").text();
                if (name.length) series_name = name;
            }
            yNames.push(series_name);

            //map new X values
            s.data.forEach((d) => {
                const date = new Date(d.category);
                d.newCat = date.toLocaleDateString();
                d.newCatIdx = categories.findIndex(x => x === d.newCat);
                if (d.newCatIdx < 0) {
                    d.newCatIdx = categories.length;
                    categories.push(d.newCat);
                }
            });

            //aggregate
            categories.forEach((c, cIdx) => {
                let avg = s.data.filter((d) => d.newCatIdx === cIdx)
                    .reduce((total, d, idx, arr) => {
                        total += d.y;
                        if (idx === arr.length - 1) {
                            return total / arr.length;
                        } else {
                            return total;
                        }
                    }, 0);
                newData.push([cIdx, sIdx, avg]);
            });
        });
        //Highcharts expects data to be sorted
        newData = newData.sort((a, b) => {
            if (a[0] === b[0]) {
                return a[1] - b[1];
            } else {
                return a[0] - b[0];
            }
        });
        let newSeries = {
            type: 'heatmap',
            data: newData,
            dataLabels: {
                enabled: true,
                color: '#000000',
                format: '{point.value:.2f}',
                crop: true,
                overflow: "justify"
            },

        }
        let newChartOpts = {
            type: 'heatmap',
            series: [newSeries],
            title: {
                text: title.split(PU_HEATMAP)[0] + " Heatmap"
            },
            credits: {
                enabled: false
            },
            xAxis: {
                categories: categories,
                reversed: true
            },
            yAxis: {
                categories: yNames,
                title: null,
                reversed: true
            },
            tooltip: {
                enabled: true,
                formatter: function () {
                    return 'Date:<b>' + getPointCategoryName(this.point, 'x') + '</b><br>' +
                        'App:<b>' + getPointCategoryName(this.point, 'y') + '</b><br>' +
                        title.split(' ')[0] + ':<b>' + this.point.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</b>';
                }
            },
            colorAxis: colorAxis,
            exporting: {
                enabled: true,
                fallbackToExportServer: true,
                libURL: pub.POWERUP_EXT_URL + '3rdParty/Highcharts/lib',
                buttons: {
                    contextButton: {
                        //    ["printChart", "separator", "downloadPNG", "downloadJPEG", "downloadPDF", "downloadSVG", "separator", "downloadCSV", "downloadXLS", "viewData", "openInCloud"]
                        menuItems: ["downloadSVG", "downloadPDF", "separator", "downloadCSV", "downloadXLS", "printChart"]
                    }
                }
            }
        }

        //$(oldContainer).css('z-index', -100);
        $(oldContainer).hide();
        $newContainer.html('');
        let newChart = Highcharts.chart(newContainer, newChartOpts, () => {
            $newContainer.find("tspan").attr("stroke", "");
            $newContainer.find(".highcharts-data-label text")
                .css("font-weight", "")
                .css("fill", txtColor)
                .css("font-size", "10px");
            $newContainer.find("rect.highcharts-point").attr("stroke", "gray");
        });
        //newChart.poweredup = true;
        $(".highcharts-exporting-group").addClass("powerupVisible");
        return true;
    }

    pub.PUfunnel = function () {
        if (!pub.config.Powerups.funnelPU) return;
        let mainPromise = new $.Deferred();
        let $funnels = $(FUNNEL_SELECTOR);
        if (!$funnels.length) { //no funnels on this dashboard
            if (D3MutexBlocking) { //old Mutex
                console.log("Powerup: DEBUG - D3MutexBlocking but no D3s. Clear it.");
                D3MutexBlocking = false;
                return false;
            } else { //nothing to do
                return false;
            }
        } else { //funnels found
            if (D3MutexBlocking) { //already running, block it
                console.log("Powerup: D3MutexBlocked Funnel Powerup");
                return false;
            } else { //normal
                D3MutexBlocking = true;
                $.when(mainPromise).always(() => { //be sure to clear mutex when done
                    D3MutexBlocking = false;
                })
            }
        }


        const options = {
            chart: {
                curve: {
                    enabled: true,
                    height: 40
                },
                //animate: 50,
                bottomPinch: 1
            },
            block: {
                minHeight: 100,
                dynamicHeight: false,
                dynamicSlope: false,
                barOverlay: false,
                fill: {
                    type: 'gradient',
                    //scale: 
                },
                //highlight: true
            },
            label: {
                fill: "#fff",
                enabled: false //make html ones instead
            },
            //tooltip: {
            //    enabled: true,
            //},
            //events: {
            //click: {
            //    block: funnelClickHandler
            //}
            //}
        }

        $(FUNNEL_SELECTOR).each((i, el) => {
            let $funnelpanel = $(el);
            let $tile = $funnelpanel.parents(TILE_SELECTOR);
            let $title = $tile.find(TITLE_SELECTOR);

            if ($title.text().includes(PU_FUNNEL)) {
                let titletokens = $title.text().split(PU_FUNNEL);
                let argstring = titletokens[1];
                let args = argstring.split(";").map(x => x.split("="));
                let mode = args.find(x => x[0] == "mode")[1];
                let small = Number(args.find(x => x[0] == "small")[1]);
                let big = Number(args.find(x => x[0] == "big")[1]);
                let links = args.find(x => x[0] == "links")[1];

                let $linkstile = $(pub.findLinkedMarkdown(links));
                let mdtext = $linkstile.text();
                $linkstile.hide();
                const linkRE = /^(?:\d+=)(.*)/gm;
                let linkList = Array.from(mdtext.matchAll(linkRE))
                    .map(x => x[1]);

                //styling
                switch (mode) {
                    case "slope":
                        options.block.dynamicSlope = true;
                        options.block.dynamicHeight = false;
                        options.block.barOverlay = false;
                        break;
                    case "bar":
                        options.block.dynamicSlope = false;
                        options.block.dynamicHeight = false;
                        options.block.barOverlay = true;
                        break;
                    case "height":
                    default:
                        options.block.dynamicSlope = false;
                        options.block.dynamicHeight = true;
                        options.block.barOverlay = false;
                        break;
                }

                //get the data
                let $steps = $funnelpanel.children(`div:nth-of-type(2)`).children();
                let numSteps = $steps.length;
                let steps = [];
                $steps.each((i, stepEl) => {
                    let $stepEl = $(stepEl);
                    let step = {};
                    step.abs = Number($stepEl.find(`div:first-of-type > span:nth-of-type(1)`).text().replace(/[,]*/g, ''));
                    step.percent = Number($stepEl.find(`div:first-of-type > span:nth-of-type(2)`).text().replace(/[()%]*/g, ''));
                    step.dPercent = Number($stepEl.children(`span:nth-of-type(1)`).text().replace(/[()%]*/g, ''));
                    step.dTime = $stepEl.children(`span:nth-of-type(2)`).text();
                    step.name = $stepEl.children(`div:nth-of-type(2)`).text();

                    step.label = step.name;
                    step.value = step.abs;
                    step.customFormattedValue = `
                        ${step.name}: <b>${step.abs}</b> (${step.percent}%)<br>
                        <small>${step.dPercent}% ${step.dTime}</small>
                        `.trim();

                    steps.push(step);
                })

                //hide old stuff
                $funnelpanel.find(`div:nth-of-type(1)`).hide();
                $funnelpanel.find(`div:nth-of-type(2)`).hide();

                //new funnel
                let $funnelContainer = $("#powerupFunnelContainer");
                if (!$funnelContainer.length)
                    $funnelContainer = $("<div>")
                        .attr("id", "powerupFunnelContainer")
                        .appendTo($funnelpanel);

                let chart = new D3Funnel($funnelContainer[0]);
                chart.draw(steps, options);

                //add HTML labels
                let tries = 5;
                function updateLabels() {
                    steps.forEach((step, idx) => {
                        let $path = $funnelContainer.find(`svg g:nth-of-type(${idx + 1}) path`);
                        let path = $path.get(0);
                        let pathBBox = path.getBBox();
                        let $label = $("<div>")
                            .addClass("powerupFunnelLabel")
                            .html(step.customFormattedValue)
                            .appendTo($funnelContainer);

                        let cp = $funnelContainer.position();
                        let x = cp.left + $funnelContainer.width() / 2 - $label.width() / 2;
                        let y = pathBBox.y + pathBBox.height / 2 - $label.height() / 2;
                        $label.css({ top: y, left: x });


                        //update background color too
                        let $grad = $funnelContainer.find(`svg linearGradient:nth-of-type(${idx + 1})`).eq(0);
                        let color;
                        if (step.dPercent < big * -1)
                            color = "#dc172a"; //bold red
                        else if (step.dPercent > big)
                            color = "#54c27d"; //bold green
                        else if (step.dPercent < small * -1)
                            color = "#f28289"; //light red
                        else if (step.dPercent > small)
                            color = "#99dea8"; //light green
                        else
                            color = "#898989"; //gray

                        function shade(c1) {
                            const { r, g, b } = d3.color(c1);
                            const shade = -0.2;
                            const t = shade < 0 ? 0 : 255;
                            const p = shade < 0 ? shade * -1 : shade;
                            const converted = 0x1000000 +
                                ((Math.round((t - r) * p) + r) * 0x10000) +
                                ((Math.round((t - g) * p) + g) * 0x100) +
                                (Math.round((t - b) * p) + b);
                            return `#${converted.toString(16).slice(1)}`; //replicate logic from d3-funnel gradient
                        }
                        let sideColor = shade(color);

                        function updateGradients(c1, c2) {
                            $grad.find("stop").each((stopI, stopEl) => {
                                switch (stopI) {
                                    case 0:
                                    case 3:
                                        $(stopEl).css("stop-color", c2);
                                        break;
                                    case 1:
                                    case 2:
                                    default:
                                        $(stopEl).css("stop-color", c1);
                                }
                            });
                        }
                        updateGradients(color, sideColor);
                        if (idx === 0) { //pain the back of funnel
                            let $back = $funnelContainer.find("svg > path").eq(0);
                            $back.attr("fill", sideColor);
                        }

                        //fix hovering
                        let hColor = "#008cdb";
                        let hSideColor = shade(hColor);
                        $path.add($label).hover(
                            () => { updateGradients(hColor, hSideColor); },
                            () => { updateGradients(color, sideColor); });


                        //add drilldowns
                        $path.add($label).click(
                            () => { window.location.href = linkList[idx] });

                    });
                    console.log("Powerup: Funnel power up found");
                    mainPromise.resolve(true);
                }
                function checkForDoneDrawing() {
                    if (!tries) {
                        mainPromise.resolve(false);
                        return false;
                    }
                    let funnelLen = $funnelContainer.find(`svg g`).length;
                    if (funnelLen == steps.length)
                        updateLabels();
                    else {
                        tries--;
                        console.log(`checkForDoneDrawing: ${funnelLen} < ${steps.length}, tries: ${tries}`);
                        setTimeout(checkForDoneDrawing, 100);
                    }
                }
                checkForDoneDrawing();
            } else {
                mainPromise.resolve(false);
            }
        });
        return mainPromise;
    }

    pub.PUMath = function () {  //example: !PU(math):exp=(x1+x2+x3+x4)/4;scope=x1,x2,x3,x4:link4;color=blue
        if (!pub.config.Powerups.mathPU) return;

        //find math PUs
        $(MARKDOWN_SELECTOR).each((i, el) => {
            let $container = $(el);
            let $tile = $container.parents(".grid-tile");
            let text = $container.text();

            if (!text.includes(PU_MATH)) return;
            if (pub.config.Powerups.debug) console.log("Powerup: math power-up found");
            let argstring = text.split(PU_MATH)[1];

            let args = argstring.split(";").map(x => x.split("="));
            let exp = args.find(x => x[0] == "exp")[1];
            let scopeStr = args.find(x => x[0] == "scope")[1];
            let color = (args.find(x => x[0] == "color") || [])[1] || "white";
            let size = (args.find(x => x[0] == "size") || [])[1] || "36px";

            let scope = scopeStr.trim().split(',')
                .map(x => (x.includes(':')
                    ? {
                        name: x.split(':')[0],
                        link: x.split(':')[1],
                    }
                    : {
                        name: x,
                        link: x
                    })
                )

            scope.forEach(s => {
                s.val = pub.findLinkedVal(s.link);
            });


            //generate weird mexp formats
            let tokens = scope.map(x => ({
                type: 3,
                token: x.name,
                show: x.name,
                value: x.name
            }));
            let pairs = {}
            scope.forEach(x => {
                let token = x.name;
                pairs[token] = x.val;
            });

            //calculate
            let fmt = Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format;
            let calcVal = fmt(mexp.eval(exp, tokens, pairs));

            //swap markdown content
            $container.hide();
            let $newContainer = $("<div>")
                .addClass("powerupMath")
                .insertAfter($container);
            let h1 = $("<h1>")
                .text(calcVal)
                .css("color", color)
                .css("font-size", size)
                .appendTo($newContainer);
        });
    }

    pub.puDate = function () { //example: !PU(date):res=now-7d/d;fmt=yyyy-mm-dd;color=blue
        if (!pub.config.Powerups.datePU) return;

        //find math PUs
        $(MARKDOWN_SELECTOR).each((i, el) => {
            let $container = $(el);
            let $tile = $container.parents(".grid-tile");
            let text = $container.text();

            if (!text.includes(PU_DATE)) return;
            if (pub.config.Powerups.debug) console.log("Powerup: date power-up found");
            let argstring = text.split(PU_DATE)[1];

            let args = argstring.split(";").map(x => x.split("="));
            let res = args.find(x => x[0] == "res")[1];
            let fmt = args.find(x => x[0] == "fmt")[1];
            let color = args.find(x => x[0] == "color")[1];

            let dtDate = dtDateMath.resolve(res);
            let from = dtDate[0];
            let to = dtDate[1];
            let dateMs = dtDate[2].start;

            let formattedDate = dateFns.format(dateMs, fmt);

            //swap markdown content
            $container.hide();
            let $newContainer = $("<div>")
                .addClass("powerupDate")
                .insertAfter($container);
            let h1 = $("<h2>")
                .text(formattedDate)
                .css("color", color)
                .appendTo($newContainer);
        });
    }

    pub.puGauge = function (chart, title, retries = 3) {
        if (!pub.config.Powerups.gaugePU) return false;

        //prep gauges
        let p = new $.Deferred();
        let $container = $(chart.container);
        let $tile = $container.parents(TILE_SELECTOR);
        let $panel = $tile.find(SVT_PANEL_SELECTOR);
        let titletokens = title.split(PU_GAUGE);
        let argstring = titletokens[1];
        let args = argstring.split(";").map(x => x.split("="));
        if (args.length < 2) {
            if (pub.config.Powerups.debug)
                console.log("Powerup: ERROR - invalid argstring: " + argstring);
            return false;
        }
        let vals = ((args.find(x => x[0] == "stops") || [])[1]);
        if (vals) vals = vals.split(',').map(x => Number(x.replace(/,/g, '')));
        else return false;
        let colors = ((args.find(x => x[0] == "colors") || [])[1]);
        if (colors) colors = colors.split(',');
        else return false;
        let min = Number(((args.find(x => x[0] == "min") || [])[1]) || 0);
        let max = Number(((args.find(x => x[0] == "max") || [])[1]) || 100);
        let stops = [];
        vals.forEach((v, i) => {
            let stop = [v, colors[i]];
            stops.push(stop);
        });



        //swap
        $panel.hide();
        let val = Number($panel.find(VAL_SELECTOR).text().replace(/,/g, ''));
        let metric = $panel.find(SVT_METRIC_SELECTOR).text();
        let units = $panel.find(SVT_UNITS_SELECTOR).text();
        let $newContainer = $("<div>")
            .addClass("powerupGauge")
            .insertAfter($panel);

        //new chart
        //default options
        var gaugeOptions = {
            chart: {
                type: 'solidgauge',
                backgroundColor: '#353535'
            },
            title: null,
            pane: {
                center: ['50%', '35%'],
                //size: '140%',
                startAngle: -90,
                endAngle: 90,
                background: {
                    backgroundColor: '#454646',
                    innerRadius: '60%',
                    outerRadius: '100%',
                    shape: 'arc',
                    borderColor: '#454646'
                }
            },
            exporting: {
                enabled: false
            },
            tooltip: {
                enabled: false
            },
            yAxis: {
                stops: stops,
                lineWidth: 0,
                tickWidth: 0,
                minorTickInterval: null,
                tickAmount: 2,
                //tickInterval: 1,
                labels: {
                    y: 16,
                    style: {
                        color: '#ffffff'
                    }
                },
                title: {
                    text: metric,
                    y: -70,
                    style: {
                        color: '#ffffff'
                    }
                },
                min: min,
                max: max
            },
            series: [{
                name: metric,
                data: [val],
                dataLabels: {
                    format:
                        '<div style="text-align:center">' +
                        '<span style="font-size:25px">{y:.1f}</span>' +
                        `<span style="font-size:12px;opacity:0.4">${units}</span>` +
                        '</div>',
                    color: '#ffffff',
                    borderWidth: 0,
                    y: -20
                },
                tooltip: {
                    valueSuffix: ` ${units}`
                }
            }]
        }
        let gaugeChart = Highcharts.charts
            .filter(x => typeof (x) != "undefined")
            .filter(x => x.container === $newContainer[0])
        [0];
        if (gaugeChart)
            gaugeChart.update(gaugeOptions, true, false);
        else
            gaugeChart = Highcharts.chart($newContainer[0], gaugeOptions, () => { });
    }

    pub.extDisclaimer = function () {
        const DISC_HEIGHT = 76;
        const DISC_TEXT = 'Powerup Enabled Dashboard';

        //hide the disclaimer, since the user has the ext
        $(MARKDOWN_SELECTOR).each((i, el) => {
            let $md = $(el);
            if ($md.text().includes(DISC_TEXT) &&
                $md.is(':visible')) {
                $md.hide();
                moveTilesUp();
            }
        })

        //move everything up
        function moveTilesUp() {
            $(TILE_SELECTOR).each((i, el) => {
                let $tile = $(el);
                let top = $tile.css("top");
                top = top.substr(0, top.length - 2);
                top = Number(top);
                top -= DISC_HEIGHT;
                top = top + 'px';
                $(el).css("top", top);
            });
        }
    }

    pub.fireAllPowerUps = function (update = false) {
        let mainPromise = new $.Deferred();
        let promises = [];

        promises.push(pub.extDisclaimer());
        promises.push(pub.PUHighcharts());
        promises.push(pub.bannerPowerUp());
        promises.push(pub.colorPowerUp());
        promises.push(pub.updateSVGPowerUp());
        promises.push(pub.svgPowerUp());
        promises.push(pub.mapPowerUp());
        promises.push(pub.PUfunnel());
        promises.push(pub.PUMath());
        promises.push(pub.puDate());
        pub.loadChartSync();
        waitForHCmod('sankey', () => { promises.push(pub.sankeyPowerUp()) });

        $.when.apply($, promises).always(function () {
            let p = pub.cleanMarkup();
            if (pub.config.Powerups.debug)
                console.log("Powerup: DEBUG - fire all PowerUps" + (update ? " (update)" : ""));
            $.when(p).always(() => {
                mainPromise.resolve();
            });
        });

        return mainPromise;
    }

    pub.GridObserver = (function () {
        /* New method for deciding when to fire powerups
            Step 1 (extside) - inject clientside lib, if not already
            Step 2 (extside) - inject trigger to launch Mutation observer
            Step 3 (clientside) - launch new observer on the dashboard grid, discard if already exists
            Step 4 (clientside) - when a mutation occurs (this should be tiles loading), flag it, start timeout of 50ms
            Step 5 - continue updating timeout to 50ms until mutation stop
            Step 6 - once no mutations occur for 50ms, disable observer, fire powerups
            Step 7 - once powerups are complete, reenable observer, repeat from step 4
            */
        const time = 200;
        const MO_CONFIG = { attributes: true, childList: true, subtree: false };
        var GO = {};
        var observer = {};
        var timeout = {};
        const firstRunRaceTime = 1000;

        const mutationHappening = (mutationsList, obs) => {
            if (pub.config.Powerups.debug) {
                console.log("Powerup: DEBUG - mutations happening:");
                console.log(mutationsList);
            }
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                mutationsDone(mutationsList, obs);
            }, time);
        }

        const mutationsDone = (mutationsList, obs) => {
            let p;
            if (pub.config.Powerups.debug) {
                console.log("Powerup: DEBUG - mutations have stopped.");
            }
            observer.disconnect();
            if (window.location.hash.startsWith("#dashboard;") ||
                window.location.hash.startsWith("#dashboard/dashboard;")) {
                if ($('[uitestid="gwt-debug-dashboardGrid"]').length &&        //grid is loaded
                    !$(".loader:visible").length &&                            //main loading distractor gone
                    !$('[uitestid="gwt-debug-tileLoader"]:visible').length) {  //tile distractors hidden)
                    p = pub.fireAllPowerUps();
                } else { //still loading apparently, wait and try again
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        mutationsDone(mutationsList, obs);
                    }, firstRunRaceTime);
                }

                $.when(p).done(() => {
                    GO.observeGrid();
                })
            }
        }

        GO.launchGridObserver = () => {
            observer = new MutationObserver(mutationHappening);
            GO.observeGrid();

            //backstop initial race condition
            timeout = setTimeout(() => {
                mutationsDone(undefined, undefined);
            }, firstRunRaceTime);
        };

        GO.observeGrid = () => {
            const GRID_SELECTOR = '.grid-dashboard';
            const TITLE_SELECTOR = '[uitestid="gwt-debug-title"]';

            let $grid = $(GRID_SELECTOR);
            if ($grid.length < 1) return false;
            $grid.each((i, grid) => {
                observer.observe(grid, { attributes: true, childList: true, subtree: false });
            });

            let $titles = $(TITLE_SELECTOR);
            if ($titles.length) {
                $titles.each((i, title) => {
                    observer.observe(title, { attributes: true, childList: true, subtree: false });
                })
            }
        }

        return GO;
    })();

    return pub;
})();