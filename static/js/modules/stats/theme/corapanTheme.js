/**
 * CO.RA.PAN ECharts Theme
 * Material Design 3 color palette
 */

export default {
  color: [
    "#1B5E9F", // primary
    "#5A7FA3", // primary-container
    "#78909C", // secondary
    "#B0BEC5", // secondary-container
    "#455A64", // tertiary
    "#90A4AE", // tertiary-container
  ],

  backgroundColor: "transparent",

  textStyle: {
    fontFamily:
      'system-ui, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    fontSize: 14,
    color: undefined, // Will use CSS variable
  },

  title: {
    textStyle: {
      fontWeight: 500,
      fontSize: 16,
      color: undefined,
    },
    subtextStyle: {
      fontSize: 14,
      color: undefined,
    },
  },

  line: {
    itemStyle: {
      borderWidth: 2,
    },
    lineStyle: {
      width: 2,
    },
    symbolSize: 6,
    symbol: "circle",
    smooth: false,
  },

  bar: {
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
    },
  },

  pie: {
    itemStyle: {
      borderRadius: 4,
      borderWidth: 2,
      borderColor: "#fff",
    },
  },

  scatter: {
    itemStyle: {
      borderWidth: 0,
    },
    symbolSize: 8,
  },

  boxplot: {
    itemStyle: {
      borderWidth: 1,
    },
  },

  parallel: {
    itemStyle: {
      borderWidth: 0,
    },
    lineStyle: {
      width: 1,
    },
  },

  sankey: {
    itemStyle: {
      borderWidth: 0,
    },
    lineStyle: {
      width: 1,
      color: "#ccc",
    },
  },

  funnel: {
    itemStyle: {
      borderWidth: 0,
    },
  },

  gauge: {
    itemStyle: {
      borderWidth: 0,
    },
  },

  candlestick: {
    itemStyle: {
      color: "#26A69A",
      color0: "#EF5350",
      borderColor: "#26A69A",
      borderColor0: "#EF5350",
      borderWidth: 1,
    },
  },

  graph: {
    itemStyle: {
      borderWidth: 0,
    },
    lineStyle: {
      width: 1,
      color: "#ccc",
    },
    symbolSize: 6,
    symbol: "circle",
    smooth: false,
    color: ["#1B5E9F", "#5A7FA3", "#78909C", "#B0BEC5", "#455A64", "#90A4AE"],
    label: {
      color: "#fff",
    },
  },

  categoryAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.2)",
      },
    },
    axisTick: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.12)",
      },
    },
    axisLabel: {
      show: true,
      color: undefined, // Will use CSS variable
    },
    splitLine: {
      show: false,
    },
    splitArea: {
      show: false,
    },
  },

  valueAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      show: true,
      color: undefined,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.08)",
        type: "solid",
      },
    },
    splitArea: {
      show: false,
    },
  },

  logAxis: {
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      show: true,
      color: undefined,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.08)",
      },
    },
    splitArea: {
      show: false,
    },
  },

  timeAxis: {
    axisLine: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.2)",
      },
    },
    axisTick: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.12)",
      },
    },
    axisLabel: {
      show: true,
      color: undefined,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "rgba(0, 0, 0, 0.08)",
      },
    },
    splitArea: {
      show: false,
    },
  },

  toolbox: {
    iconStyle: {
      borderColor: "rgba(0, 0, 0, 0.54)",
    },
    emphasis: {
      iconStyle: {
        borderColor: "#1B5E9F",
      },
    },
  },

  legend: {
    textStyle: {
      color: undefined,
    },
  },

  tooltip: {
    axisPointer: {
      lineStyle: {
        color: "rgba(0, 0, 0, 0.38)",
        width: 1,
      },
      crossStyle: {
        color: "rgba(0, 0, 0, 0.38)",
        width: 1,
      },
    },
  },

  timeline: {
    lineStyle: {
      color: "#90A4AE",
      width: 1,
    },
    itemStyle: {
      color: "#78909C",
      borderWidth: 1,
    },
    controlStyle: {
      color: "#1B5E9F",
      borderColor: "#1B5E9F",
      borderWidth: 1,
    },
    checkpointStyle: {
      color: "#1B5E9F",
      borderColor: "rgba(27, 94, 159, 0.3)",
    },
    label: {
      color: undefined,
    },
    emphasis: {
      itemStyle: {
        color: "#5A7FA3",
      },
      controlStyle: {
        color: "#1B5E9F",
        borderColor: "#1B5E9F",
        borderWidth: 1,
      },
      label: {
        color: undefined,
      },
    },
  },

  visualMap: {
    color: ["#1B5E9F", "#5A7FA3", "#78909C", "#B0BEC5"],
    textStyle: {
      color: undefined,
    },
  },

  dataZoom: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    dataBackgroundColor: "rgba(27, 94, 159, 0.3)",
    fillerColor: "rgba(27, 94, 159, 0.15)",
    handleColor: "#1B5E9F",
    handleSize: "100%",
    textStyle: {
      color: undefined,
    },
  },

  markPoint: {
    label: {
      color: "#fff",
    },
    emphasis: {
      label: {
        color: "#fff",
      },
    },
  },
};
