/**
 * ECharts Bar Chart Renderer for CO.RA.PAN Statistics
 *
 * Renders horizontal bar charts with MD3 styling.
 * Supports automatic rotation for long category lists and responsive resize.
 *
 * NOTE: Requires ECharts to be loaded globally (via CDN or script tag).
 */

import corapanTheme from "./theme/corapanTheme.js";

// ECharts is loaded globally from CDN
// We access it dynamically inside functions to ensure it's available

/**
 * Format number with Spanish locale
 */
function formatNumber(n) {
  return new Intl.NumberFormat("es-ES").format(n);
}

/**
 * Format percentage with Spanish locale
 */
function formatPercent(p) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(p);
}

/**
 * Get text color from CSS variable based on current theme
 */
function getTextColor() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-on-surface")
      .trim() || "#1C1B1F"
  );
}

/**
 * Render a bar chart in the specified container
 *
 * @param {HTMLElement} container - Chart container element
 * @param {Array<{key: string, n: number, p: number}>} data - Chart data
 * @param {string} title - Chart title (Spanish)
 * @param {string} displayMode - Display mode: 'absolute' (default) or 'percent'
 * @param {string} orientation - 'horizontal' (default) or 'vertical'
 * @returns {echarts.ECharts} Chart instance
 */
export function renderBar(
  container,
  data,
  title,
  displayMode = "absolute",
  orientation = "horizontal",
) {
  if (!container) {
    console.error("renderBar: container is null or undefined");
    return null;
  }

  const echarts = window.echarts;
  if (!echarts) {
    console.error("ECharts not loaded! Include ECharts CDN in the HTML.");
    container.innerHTML =
      '<div class="chart-error">Error: ECharts library not loaded.</div>';
    return null;
  }

  // Register theme if not already registered
  try {
    echarts.registerTheme("corapan", corapanTheme);
  } catch (e) {
    // Ignore if already registered
  }

  // Handle empty data
  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="chart-empty">Sin datos para los filtros actuales.</div>';
    return null;
  }

  // Dispose existing chart instance
  const existingInstance = echarts.getInstanceByDom(container);
  if (existingInstance) {
    existingInstance.dispose();
  }

  // Initialize chart
  const chart = echarts.init(container, "corapan", {
    renderer: "canvas",
    useDirtyRect: false,
  });

  // Get current text color (supports light/dark mode)
  const textColor = getTextColor();

  // Get primary color from CSS (supports dark mode)
  const primaryColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-primary")
      .trim() || "#1B5E9F";

  const primaryContainerColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-primary-container")
      .trim() || "#5A7FA3";

  // Calculate total for percentages if not provided
  const total = data.reduce((sum, item) => sum + item.n, 0);

  // Extract categories and values based on display mode
  const categories = data.map((item) => item.label || item.key);

  // Ensure p is calculated if missing
  const processedData = data.map((item) => {
    const p = item.p !== undefined ? item.p : total > 0 ? item.n / total : 0;
    return { ...item, p };
  });

  const values =
    displayMode === "percent"
      ? processedData.map((item) => item.p * 100) // Convert to percentage (0-100 scale)
      : processedData.map((item) => item.n);

  const absoluteValues = processedData.map((item) => item.n);
  const proportions = processedData.map((item) => item.p);

  // Determine layout based on orientation
  const isVertical = orientation === "vertical";

  // Chart configuration
  const option = {
    backgroundColor: "transparent",
    animation: true,
    animationDuration: 500,
    grid: {
      top: 30,
      bottom: isVertical ? 30 : 10,
      left: isVertical ? 40 : 10,
      right: isVertical ? 10 : 60, // Space for labels in horizontal
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor:
        getComputedStyle(document.documentElement).getPropertyValue(
          "--md-sys-color-surface-container",
        ) || "#fff",
      borderColor:
        getComputedStyle(document.documentElement).getPropertyValue(
          "--md-sys-color-outline-variant",
        ) || "#ccc",
      textStyle: {
        color: textColor,
      },
      formatter: function (params) {
        const item = params[0];
        const index = item.dataIndex;
        const absVal = formatNumber(absoluteValues[index]);
        const p = proportions[index];
        const percentStr = `(${formatPercent(p)})`;

        return `
          <div style="font-family: Roboto, sans-serif;">
            <strong>${item.name}</strong><br/>
            <span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${item.color};"></span>
            ${absVal} hits ${percentStr}
          </div>
        `;
      },
    },
    xAxis: isVertical
      ? {
          type: "category",
          data: categories,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: textColor,
            fontFamily: "Roboto, sans-serif",
            interval: 0,
            rotate: categories.length > 5 ? 45 : 0, // Rotate if many categories
          },
        }
      : {
          type: "value",
          show: true, // Show value axis
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(128, 128, 128, 0.2)",
              type: "dashed",
            },
          },
          axisLabel: {
            color: textColor,
            formatter:
              displayMode === "percent"
                ? (val) => `${val}%`
                : (val) => formatNumber(val),
          },
        },
    yAxis: isVertical
      ? {
          type: "value",
          show: true, // Show value axis
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(128, 128, 128, 0.2)",
              type: "dashed",
            },
          },
          axisLabel: {
            color: textColor,
            formatter:
              displayMode === "percent"
                ? (val) => `${val}%`
                : (val) => formatNumber(val),
          },
        }
      : {
          type: "category",
          data: categories,
          inverse: true, // Top to bottom
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: textColor,
            fontFamily: "Roboto, sans-serif",
            width: 140, // Fixed width for labels
            overflow: "truncate", // Truncate if too long
            interval: 0,
          },
        },
    series: [
      {
        name: title,
        type: "bar",
        data: values,
        label: {
          show: true,
          position: isVertical ? "top" : "right",
          formatter: function (params) {
            const index = params.dataIndex;
            const absVal = formatNumber(absoluteValues[index]);
            return absVal;
          },
          color: textColor,
        },
        itemStyle: {
          color: function (params) {
            // Use a palette for vertical charts to make them look nicer
            if (isVertical) {
              const palette = [
                "#1B5E9F",
                "#006C4C",
                "#9A4058",
                "#6750A4",
                "#8B5000",
              ];
              return palette[params.dataIndex % palette.length];
            }
            return primaryColor;
          },
          borderRadius: isVertical ? [4, 4, 0, 0] : [0, 4, 4, 0], // Rounded top or right
        },
        emphasis: {
          itemStyle: {
            color: primaryContainerColor,
          },
        },
        barWidth: isVertical ? "60%" : undefined, // Dynamic width for vertical bars
        barMaxWidth: isVertical ? 120 : 40, // Limit bar thickness
      },
    ],
  };

  chart.setOption(option);

  // Setup resize observer for responsive behavior
  const resizeObserver = new ResizeObserver(() => {
    chart.resize();
  });
  resizeObserver.observe(container);

  // Store observer on chart instance for cleanup
  chart._resizeObserver = resizeObserver;

  return chart;
}

/**
 * Update chart for theme changes (dark/light mode)
 *
 * @param {echarts.ECharts} chart - Chart instance
 */
export function updateChartTheme(chart) {
  if (!chart) return;

  const textColor = getTextColor();

  chart.setOption(
    {
      xAxis: {
        axisLabel: {
          color: textColor,
        },
      },
      yAxis: {
        axisLabel: {
          color: textColor,
        },
      },
    },
    { notMerge: false },
  );
}

/**
 * Update chart display mode (absolute ↔ percentage) with smooth transition
 *
 * @param {echarts.ECharts} chart - Chart instance
 * @param {Array<{key: string, n: number, p: number}>} data - Chart data
 * @param {string} displayMode - 'absolute' or 'percent'
 */
export function updateChartMode(chart, data, displayMode) {
  if (!chart || !data) return;

  const textColor = getTextColor();
  const usePercent = displayMode === "percent";
  const values = usePercent
    ? data.map((item) => item.p * 100)
    : data.map((item) => item.n);

  // Determine orientation from current option
  const option = chart.getOption();
  const isVertical = option.xAxis[0].type === "category";

  // Update axis formatter
  const axisFormatter = usePercent
    ? (val) => `${val}%`
    : (val) => formatNumber(val);

  const axisUpdate = {};
  if (isVertical) {
    axisUpdate.yAxis = {
      axisLabel: { formatter: axisFormatter },
    };
  } else {
    axisUpdate.xAxis = {
      axisLabel: { formatter: axisFormatter },
    };
  }

  // Update with smooth transition
  chart.setOption({
    ...axisUpdate,
    series: [
      {
        data: values,
        label: {
          formatter: function (params) {
            if (usePercent) {
              return params.value.toFixed(1) + "%";
            }
            return formatNumber(params.value);
          },
        },
      },
    ],
  });
}

/**
 * Dispose chart and cleanup resources
 *
 * @param {echarts.ECharts} chart - Chart instance
 */
export function disposeChart(chart) {
  if (!chart) return;

  // Cleanup resize observer
  if (chart._resizeObserver) {
    chart._resizeObserver.disconnect();
    delete chart._resizeObserver;
  }

  chart.dispose();
}
