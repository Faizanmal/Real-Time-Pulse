import { Injectable } from '@nestjs/common';

/**
 * Pre-built function libraries for user scripts
 */
@Injectable()
export class ScriptLibraryService {
  /**
   * Get all available library functions
   */
  getLibraries(): Record<string, Record<string, Function>> {
    return {
      math: this.getMathLibrary(),
      date: this.getDateLibrary(),
      string: this.getStringLibrary(),
      array: this.getArrayLibrary(),
      stats: this.getStatsLibrary(),
      format: this.getFormatLibrary(),
      transform: this.getTransformLibrary(),
    };
  }

  /**
   * Math utility functions
   */
  private getMathLibrary(): Record<string, Function> {
    return {
      // Basic operations
      add: (a: number, b: number) => a + b,
      subtract: (a: number, b: number) => a - b,
      multiply: (a: number, b: number) => a * b,
      divide: (a: number, b: number) => (b !== 0 ? a / b : 0),
      mod: (a: number, b: number) => a % b,

      // Rounding
      round: (n: number, decimals: number = 0) =>
        Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals),
      ceil: Math.ceil,
      floor: Math.floor,
      truncate: Math.trunc,

      // Advanced
      power: Math.pow,
      sqrt: Math.sqrt,
      cbrt: Math.cbrt,
      abs: Math.abs,
      sign: Math.sign,

      // Trigonometry
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,

      // Logarithms
      log: Math.log,
      log10: Math.log10,
      log2: Math.log2,
      exp: Math.exp,

      // Min/Max
      min: (...args: number[]) => Math.min(...args),
      max: (...args: number[]) => Math.max(...args),
      clamp: (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max),

      // Random
      random: () => Math.random(),
      randomInt: (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min,
      randomFloat: (min: number, max: number) =>
        Math.random() * (max - min) + min,

      // Percentage
      percentage: (value: number, total: number) =>
        total !== 0 ? (value / total) * 100 : 0,
      percentageChange: (oldValue: number, newValue: number) =>
        oldValue !== 0 ? ((newValue - oldValue) / oldValue) * 100 : 0,

      // Financial
      compound: (principal: number, rate: number, periods: number) =>
        principal * Math.pow(1 + rate, periods),
    };
  }

  /**
   * Date manipulation functions
   */
  private getDateLibrary(): Record<string, Function> {
    return {
      // Creation
      now: () => new Date(),
      create: (
        year: number,
        month: number,
        day: number,
        hour = 0,
        minute = 0,
        second = 0,
      ) => new Date(year, month - 1, day, hour, minute, second),
      parse: (dateString: string) => new Date(dateString),
      fromTimestamp: (timestamp: number) => new Date(timestamp),

      // Formatting
      format: (date: Date, format: string) => {
        const d = new Date(date);
        const tokens: Record<string, string> = {
          YYYY: d.getFullYear().toString(),
          MM: String(d.getMonth() + 1).padStart(2, '0'),
          DD: String(d.getDate()).padStart(2, '0'),
          HH: String(d.getHours()).padStart(2, '0'),
          mm: String(d.getMinutes()).padStart(2, '0'),
          ss: String(d.getSeconds()).padStart(2, '0'),
        };
        return Object.entries(tokens).reduce(
          (result, [token, value]) => result.replace(token, value),
          format,
        );
      },
      toISO: (date: Date) => new Date(date).toISOString(),
      toTimestamp: (date: Date) => new Date(date).getTime(),

      // Extraction
      getYear: (date: Date) => new Date(date).getFullYear(),
      getMonth: (date: Date) => new Date(date).getMonth() + 1,
      getDay: (date: Date) => new Date(date).getDate(),
      getDayOfWeek: (date: Date) => new Date(date).getDay(),
      getHour: (date: Date) => new Date(date).getHours(),
      getMinute: (date: Date) => new Date(date).getMinutes(),
      getSecond: (date: Date) => new Date(date).getSeconds(),
      getWeek: (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(
          ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
        );
      },
      getQuarter: (date: Date) => Math.floor(new Date(date).getMonth() / 3) + 1,

      // Manipulation
      addDays: (date: Date, days: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
      },
      addMonths: (date: Date, months: number) => {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
      },
      addYears: (date: Date, years: number) => {
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + years);
        return d;
      },
      addHours: (date: Date, hours: number) => {
        const d = new Date(date);
        d.setHours(d.getHours() + hours);
        return d;
      },
      addMinutes: (date: Date, minutes: number) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() + minutes);
        return d;
      },

      // Comparison
      diff: (date1: Date, date2: Date, unit: string = 'days') => {
        const d1 = new Date(date1).getTime();
        const d2 = new Date(date2).getTime();
        const diffMs = d1 - d2;

        switch (unit) {
          case 'seconds':
            return Math.floor(diffMs / 1000);
          case 'minutes':
            return Math.floor(diffMs / 60000);
          case 'hours':
            return Math.floor(diffMs / 3600000);
          case 'days':
            return Math.floor(diffMs / 86400000);
          case 'weeks':
            return Math.floor(diffMs / 604800000);
          case 'months':
            return Math.floor(diffMs / 2592000000);
          case 'years':
            return Math.floor(diffMs / 31536000000);
          default:
            return diffMs;
        }
      },
      isBefore: (date1: Date, date2: Date) => new Date(date1) < new Date(date2),
      isAfter: (date1: Date, date2: Date) => new Date(date1) > new Date(date2),
      isSameDay: (date1: Date, date2: Date) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return (
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate()
        );
      },

      // Range
      startOfDay: (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      endOfDay: (date: Date) => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
      },
      startOfMonth: (date: Date) => {
        const d = new Date(date);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      },
      endOfMonth: (date: Date) => {
        const d = new Date(date);
        d.setMonth(d.getMonth() + 1, 0);
        d.setHours(23, 59, 59, 999);
        return d;
      },
    };
  }

  /**
   * String manipulation functions
   */
  private getStringLibrary(): Record<string, Function> {
    return {
      // Case conversion
      toLowerCase: (str: string) => String(str).toLowerCase(),
      toUpperCase: (str: string) => String(str).toUpperCase(),
      capitalize: (str: string) =>
        String(str).charAt(0).toUpperCase() +
        String(str).slice(1).toLowerCase(),
      titleCase: (str: string) =>
        String(str).replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
        ),
      camelCase: (str: string) =>
        String(str).replace(/[-_\s]+(.)?/g, (_, c) =>
          c ? c.toUpperCase() : '',
        ),
      kebabCase: (str: string) =>
        String(str)
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase(),
      snakeCase: (str: string) =>
        String(str)
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[\s-]+/g, '_')
          .toLowerCase(),

      // Trimming
      trim: (str: string) => String(str).trim(),
      trimStart: (str: string) => String(str).trimStart(),
      trimEnd: (str: string) => String(str).trimEnd(),

      // Padding
      padStart: (str: string, length: number, char: string = ' ') =>
        String(str).padStart(length, char),
      padEnd: (str: string, length: number, char: string = ' ') =>
        String(str).padEnd(length, char),

      // Manipulation
      substring: (str: string, start: number, end?: number) =>
        String(str).substring(start, end),
      slice: (str: string, start: number, end?: number) =>
        String(str).slice(start, end),
      replace: (str: string, search: string, replacement: string) =>
        String(str).replace(search, replacement),
      replaceAll: (str: string, search: string, replacement: string) =>
        String(str).split(search).join(replacement),
      repeat: (str: string, count: number) => String(str).repeat(count),
      reverse: (str: string) => String(str).split('').reverse().join(''),

      // Search
      includes: (str: string, search: string) => String(str).includes(search),
      startsWith: (str: string, search: string) =>
        String(str).startsWith(search),
      endsWith: (str: string, search: string) => String(str).endsWith(search),
      indexOf: (str: string, search: string) => String(str).indexOf(search),
      lastIndexOf: (str: string, search: string) =>
        String(str).lastIndexOf(search),

      // Split/Join
      split: (str: string, separator: string) => String(str).split(separator),
      join: (arr: string[], separator: string = ',') => arr.join(separator),

      // Properties
      length: (str: string) => String(str).length,
      isEmpty: (str: string) => String(str).trim().length === 0,
      isNotEmpty: (str: string) => String(str).trim().length > 0,

      // Utility
      truncate: (str: string, length: number, suffix: string = '...') =>
        String(str).length > length
          ? String(str).slice(0, length - suffix.length) + suffix
          : str,
      words: (str: string) => String(str).split(/\s+/).filter(Boolean),
      wordCount: (str: string) =>
        String(str).split(/\s+/).filter(Boolean).length,
    };
  }

  /**
   * Array manipulation functions
   */
  private getArrayLibrary(): Record<string, Function> {
    return {
      // Creation
      create: (...items: any[]) => [...items],
      range: (start: number, end: number, step: number = 1) => {
        const result: any[] = [];
        for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
          result.push(i);
        }
        return result;
      },
      fill: (length: number, value: any) => Array(length).fill(value),

      // Access
      first: (arr: any[]) => arr[0],
      last: (arr: any[]) => arr[arr.length - 1],
      nth: (arr: any[], n: number) => arr[n],

      // Manipulation
      push: (arr: any[], ...items: any[]) => [...arr, ...items],
      unshift: (arr: any[], ...items: any[]) => [...items, ...arr],
      pop: (arr: any[]) => arr.slice(0, -1),
      shift: (arr: any[]) => arr.slice(1),
      concat: (...arrays: any[][]) => arrays.flat(),
      slice: (arr: any[], start: number, end?: number) => arr.slice(start, end),
      splice: (
        arr: any[],
        start: number,
        deleteCount: number,
        ...items: any[]
      ) => {
        const result = [...arr];
        result.splice(start, deleteCount, ...items);
        return result;
      },

      // Transformation
      map: (arr: any[], fn: (item: any, index: number) => any) => arr.map(fn),
      filter: (arr: any[], fn: (item: any, index: number) => boolean) =>
        arr.filter(fn),
      reduce: (
        arr: any[],
        fn: (acc: any, item: any, index: number) => any,
        initial: any,
      ) => arr.reduce(fn, initial),
      flatten: (arr: any[], depth: number = 1) => arr.flat(depth),
      flatMap: (arr: any[], fn: (item: any) => any[]) => arr.flatMap(fn),

      // Ordering
      sort: (arr: any[], compareFn?: (a: any, b: any) => number) =>
        [...arr].sort(compareFn),
      sortBy: (arr: any[], key: string, order: 'asc' | 'desc' = 'asc') =>
        [...arr].sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return order === 'asc' ? comparison : -comparison;
        }),
      reverse: (arr: any[]) => [...arr].reverse(),
      shuffle: (arr: any[]) => {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      },

      // Search
      find: (arr: any[], fn: (item: any) => boolean) => arr.find(fn),
      findIndex: (arr: any[], fn: (item: any) => boolean) => arr.findIndex(fn),
      includes: (arr: any[], item: any) => arr.includes(item),
      indexOf: (arr: any[], item: any) => arr.indexOf(item),

      // Aggregation
      every: (arr: any[], fn: (item: any) => boolean) => arr.every(fn),
      some: (arr: any[], fn: (item: any) => boolean) => arr.some(fn),
      count: (arr: any[], fn?: (item: any) => boolean) =>
        fn ? arr.filter(fn).length : arr.length,

      // Set operations
      unique: (arr: any[]) => [...new Set(arr)],
      union: (arr1: any[], arr2: any[]) => [...new Set([...arr1, ...arr2])],
      intersection: (arr1: any[], arr2: any[]) =>
        arr1.filter((item) => arr2.includes(item)),
      difference: (arr1: any[], arr2: any[]) =>
        arr1.filter((item) => !arr2.includes(item)),

      // Grouping
      groupBy: (arr: any[], key: string) =>
        arr.reduce(
          (groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
          },
          {} as Record<string, any[]>,
        ),
      chunk: (arr: any[], size: number) => {
        const result: any[] = [];
        for (let i = 0; i < arr.length; i += size) {
          result.push(arr.slice(i, i + size));
        }
        return result;
      },

      // Plucking
      pluck: (arr: any[], key: string) => arr.map((item) => item[key]),
    };
  }

  /**
   * Statistical functions
   */
  private getStatsLibrary(): Record<string, Function> {
    return {
      // Basic statistics
      sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      mean: (arr: number[]) =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
      median: (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      },
      mode: (arr: number[]) => {
        const counts = new Map<number, number>();
        arr.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
        let maxCount = 0;
        let mode = arr[0];
        counts.forEach((count, value) => {
          if (count > maxCount) {
            maxCount = count;
            mode = value;
          }
        });
        return mode;
      },

      // Range
      min: (arr: number[]) => Math.min(...arr),
      max: (arr: number[]) => Math.max(...arr),
      range: (arr: number[]) => Math.max(...arr) - Math.min(...arr),

      // Dispersion
      variance: (arr: number[]) => {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return (
          arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          arr.length
        );
      },
      standardDeviation: (arr: number[]) => {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance =
          arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          arr.length;
        return Math.sqrt(variance);
      },

      // Percentiles
      percentile: (arr: number[], p: number) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return sorted[lower];
        return (
          sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
        );
      },
      quartile: (arr: number[], q: 1 | 2 | 3) => {
        const p = q * 25;
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return sorted[lower];
        return (
          sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
        );
      },

      // Correlation
      correlation: (arr1: number[], arr2: number[]) => {
        if (arr1.length !== arr2.length || arr1.length === 0) return 0;
        const n = arr1.length;
        const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
        const mean2 = arr2.reduce((a, b) => a + b, 0) / n;

        let num = 0,
          den1 = 0,
          den2 = 0;
        for (let i = 0; i < n; i++) {
          const d1 = arr1[i] - mean1;
          const d2 = arr2[i] - mean2;
          num += d1 * d2;
          den1 += d1 * d1;
          den2 += d2 * d2;
        }

        const den = Math.sqrt(den1 * den2);
        return den === 0 ? 0 : num / den;
      },

      // Moving averages
      movingAverage: (arr: number[], window: number) => {
        const result: number[] = [];
        for (let i = 0; i < arr.length; i++) {
          const start = Math.max(0, i - window + 1);
          const subset = arr.slice(start, i + 1);
          result.push(subset.reduce((a, b) => a + b, 0) / subset.length);
        }
        return result;
      },
      exponentialMovingAverage: (arr: number[], alpha: number = 0.3) => {
        const result: number[] = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
          result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
        }
        return result;
      },

      // Growth
      cagr: (startValue: number, endValue: number, years: number) =>
        Math.pow(endValue / startValue, 1 / years) - 1,
      growthRate: (oldValue: number, newValue: number) =>
        oldValue !== 0 ? (newValue - oldValue) / oldValue : 0,

      // Counts
      count: (arr: any[]) => arr.length,
      countDistinct: (arr: any[]) => new Set(arr).size,
    };
  }

  /**
   * Formatting functions
   */
  private getFormatLibrary(): Record<string, Function> {
    return {
      // Numbers
      number: (n: number, decimals: number = 0) => n.toFixed(decimals),
      currency: (
        n: number,
        currency: string = 'USD',
        locale: string = 'en-US',
      ) =>
        new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
          n,
        ),
      percent: (n: number, decimals: number = 0) =>
        `${(n * 100).toFixed(decimals)}%`,
      compact: (n: number) => {
        const suffixes = ['', 'K', 'M', 'B', 'T'];
        let i = 0;
        while (Math.abs(n) >= 1000 && i < suffixes.length - 1) {
          n /= 1000;
          i++;
        }
        return `${n.toFixed(1)}${suffixes[i]}`;
      },
      ordinal: (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      },

      // File sizes
      bytes: (bytes: number) => {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
          bytes /= 1024;
          i++;
        }
        return `${bytes.toFixed(1)} ${units[i]}`;
      },

      // Duration
      duration: (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const parts: string[] = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (s > 0 || parts.length === 0) parts.push(`${s}s`);
        return parts.join(' ');
      },

      // Relative time
      relativeTime: (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
        if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
        return `${Math.floor(diffDay / 365)}y ago`;
      },
    };
  }

  /**
   * Data transformation functions
   */
  private getTransformLibrary(): Record<string, Function> {
    return {
      // Type conversion
      toNumber: (val: any) => Number(val),
      toString: (val: any) => String(val),
      toBoolean: (val: any) => Boolean(val),
      toArray: (val: any) => (Array.isArray(val) ? val : [val]),
      toObject: (entries: [string, any][]) => Object.fromEntries(entries),

      // Null handling
      coalesce: (...values: any[]) =>
        values.find((v) => v !== null && v !== undefined),
      defaultTo: (val: any, defaultVal: any) => val ?? defaultVal,

      // Conditional
      ifThen: (condition: boolean, thenVal: any, elseVal: any) =>
        condition ? thenVal : elseVal,
      when: (value: any, cases: Record<string, any>, defaultVal?: any) =>
        cases[value] !== undefined ? cases[value] : defaultVal,

      // Object transformation
      pick: (obj: Record<string, any>, keys: string[]) =>
        keys.reduce(
          (result, key) => {
            if (key in obj) result[key] = obj[key];
            return result;
          },
          {} as Record<string, any>,
        ),
      omit: (obj: Record<string, any>, keys: string[]) =>
        Object.entries(obj).reduce(
          (result, [key, value]) => {
            if (!keys.includes(key)) result[key] = value;
            return result;
          },
          {} as Record<string, any>,
        ),
      rename: (obj: Record<string, any>, mapping: Record<string, string>) =>
        Object.entries(obj).reduce(
          (result, [key, value]) => {
            result[mapping[key] || key] = value;
            return result;
          },
          {} as Record<string, any>,
        ),

      // Data reshaping
      pivot: (arr: any[], keyField: string, valueField: string) =>
        arr.reduce(
          (result, item) => {
            result[item[keyField]] = item[valueField];
            return result;
          },
          {} as Record<string, any>,
        ),
      unpivot: (
        obj: Record<string, any>,
        keyName: string = 'key',
        valueName: string = 'value',
      ) =>
        Object.entries(obj).map(([key, value]) => ({
          [keyName]: key,
          [valueName]: value,
        })),

      // Aggregation
      aggregate: (
        arr: any[],
        groupBy: string,
        aggregations: Record<
          string,
          { field: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'count' }
        >,
      ) => {
        const groups = arr.reduce(
          (acc, item) => {
            const key = item[groupBy];
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
          },
          {} as Record<string, any[]>,
        );

        return Object.entries(groups).map(([key, items]) => {
          const result: Record<string, any> = { [groupBy]: key };

          for (const [name, agg] of Object.entries(aggregations)) {
            const values = (items as any[])
              .map((i) => i[agg.field])
              .filter((v) => v !== undefined);
            switch (agg.fn) {
              case 'sum':
                result[name] = values.reduce((a, b) => a + b, 0);
                break;
              case 'avg':
                result[name] = values.length
                  ? values.reduce((a, b) => a + b, 0) / values.length
                  : 0;
                break;
              case 'min':
                result[name] = Math.min(...values);
                break;
              case 'max':
                result[name] = Math.max(...values);
                break;
              case 'count':
                result[name] = values.length;
                break;
            }
          }

          return result;
        });
      },
    };
  }
}
