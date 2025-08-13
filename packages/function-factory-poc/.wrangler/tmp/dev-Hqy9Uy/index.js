var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.6.0_unenv@2.0.0-rc.19_workerd@1.20250803.0/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.6.0_unenv@2.0.0-rc.19_workerd@1.20250803.0/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../node_modules/.pnpm/wrangler@4.28.1/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.19/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.6.0_unenv@2.0.0-rc.19_workerd@1.20250803.0/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var { exit, platform, nextTick } = getBuiltinModule(
  "node:process"
);
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  nextTick
});
var {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  finalization,
  features,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  on,
  off,
  once,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../node_modules/.pnpm/wrangler@4.28.1/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context2, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context2.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context2, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context2.error = err;
            res = await onError(err, context2);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context2.finalized === false && onNotFound) {
          res = await onNotFound(context2);
        }
      }
      if (res && (context2.finalized === false || isError)) {
        context2.res = res;
      }
      return context2;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    form[key] = value;
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match[1], new RegExp(`^${match[2]}(?=/${next})`)] : [label, match[1], new RegExp(`^${match[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decoder(match);
      } catch {
        return match;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", 8);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? decodeURIComponent_(value) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf(`?${key}`, 8);
    if (keyIndex2 === -1) {
      keyIndex2 = url.indexOf(`&${key}`, 8);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param ? /\%/.test(param) ? tryDecodeURIComponent(param) : param : void 0;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value && typeof value === "string") {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  json() {
    return this.#cachedBody("json");
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context2, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context: context2 }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context2, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setHeaders = /* @__PURE__ */ __name((headers, map = {}) => {
  for (const key of Object.keys(map)) {
    headers.set(key, map[key]);
  }
  return headers;
}, "setHeaders");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status = 200;
  #executionCtx;
  #headers;
  #preparedHeaders;
  #res;
  #isFresh = true;
  #layout;
  #renderer;
  #notFoundHandler;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    this.#isFresh = false;
    return this.#res ||= new Response("404 Not Found", { status: 404 });
  }
  set res(_res) {
    this.#isFresh = false;
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    if (value === void 0) {
      if (this.#headers) {
        this.#headers.delete(name);
      } else if (this.#preparedHeaders) {
        delete this.#preparedHeaders[name.toLocaleLowerCase()];
      }
      if (this.finalized) {
        this.res.headers.delete(name);
      }
      return;
    }
    if (options?.append) {
      if (!this.#headers) {
        this.#isFresh = false;
        this.#headers = new Headers(this.#preparedHeaders);
        this.#preparedHeaders = {};
      }
      this.#headers.append(name, value);
    } else {
      if (this.#headers) {
        this.#headers.set(name, value);
      } else {
        this.#preparedHeaders ??= {};
        this.#preparedHeaders[name.toLowerCase()] = value;
      }
    }
    if (this.finalized) {
      if (options?.append) {
        this.res.headers.append(name, value);
      } else {
        this.res.headers.set(name, value);
      }
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#isFresh = false;
    this.#status = status;
  }, "status");
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    if (this.#isFresh && !headers && !arg && this.#status === 200) {
      return new Response(data, {
        headers: this.#preparedHeaders
      });
    }
    if (arg && typeof arg !== "number") {
      const header = new Headers(arg.headers);
      if (this.#headers) {
        this.#headers.forEach((v, k) => {
          if (k === "set-cookie") {
            header.append(k, v);
          } else {
            header.set(k, v);
          }
        });
      }
      const headers2 = setHeaders(header, this.#preparedHeaders);
      return new Response(data, {
        headers: headers2,
        status: arg.status ?? this.#status
      });
    }
    const status = typeof arg === "number" ? arg : this.#status;
    this.#preparedHeaders ??= {};
    this.#headers ??= new Headers();
    setHeaders(this.#headers, this.#preparedHeaders);
    if (this.#res) {
      this.#res.headers.forEach((v, k) => {
        if (k === "set-cookie") {
          this.#headers?.append(k, v);
        } else {
          this.#headers?.set(k, v);
        }
      });
      setHeaders(this.#headers, this.#preparedHeaders);
    }
    headers ??= {};
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === "string") {
        this.#headers.set(k, v);
      } else {
        this.#headers.delete(k);
        for (const v2 of v) {
          this.#headers.append(k, v2);
        }
      }
    }
    return new Response(data, {
      status,
      headers: this.#headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  body = /* @__PURE__ */ __name((data, arg, headers) => {
    return typeof arg === "number" ? this.#newResponse(data, arg, headers) : this.#newResponse(data, arg);
  }, "body");
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    if (!this.#preparedHeaders) {
      if (this.#isFresh && !headers && !arg) {
        return new Response(text);
      }
      this.#preparedHeaders = {};
    }
    this.#preparedHeaders["content-type"] = TEXT_PLAIN;
    if (typeof arg === "number") {
      return this.#newResponse(text, arg, headers);
    }
    return this.#newResponse(text, arg);
  }, "text");
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    const body = JSON.stringify(object);
    this.#preparedHeaders ??= {};
    this.#preparedHeaders["content-type"] = "application/json";
    return typeof arg === "number" ? this.#newResponse(body, arg, headers) : this.#newResponse(body, arg);
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    this.#preparedHeaders ??= {};
    this.#preparedHeaders["content-type"] = "text/html; charset=UTF-8";
    if (typeof html === "object") {
      return resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then((html2) => {
        return typeof arg === "number" ? this.#newResponse(html2, arg, headers) : this.#newResponse(html2, arg);
      });
    }
    return typeof arg === "number" ? this.#newResponse(html, arg, headers) : this.#newResponse(html, arg);
  }, "html");
  redirect = /* @__PURE__ */ __name((location, status) => {
    this.#headers ??= new Headers();
    this.#headers.set("Location", String(location));
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    return err.getResponse();
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class {
  static {
    __name(this, "Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env2, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env2, "GET")))();
    }
    const path = this.getPath(request, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context2 = await composed(c);
        if (!context2.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context2.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class {
  static {
    __name(this, "Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context2, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new Node();
        if (name !== "") {
          node.#varIndex = context2.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new Node();
      }
    }
    node.insert(restTokens, index, paramMap, context2, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/reg-exp-router/router.js
var emptyParam = [];
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match(method, path) {
    clearWildcardRegExpCache();
    const matchers = this.#buildAllMatchers();
    this.match = (method2, path2) => {
      const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
      const staticMatch = matcher[2][path2];
      if (staticMatch) {
        return staticMatch;
      }
      const match = path2.match(matcher[0]);
      if (!match) {
        return [[], emptyParam];
      }
      const index = match.indexOf("", 1);
      return [matcher[1][index], match];
    };
    return this.match(method, path);
  }
  #buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = class {
  static {
    __name(this, "Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (Object.keys(curNode.#children).includes(key)) {
        curNode = curNode.#children[key];
        const pattern2 = getPattern(p, nextP);
        if (pattern2) {
          possibleKeys.push(pattern2[1]);
        }
        continue;
      }
      curNode.#children[key] = new Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    const m = /* @__PURE__ */ Object.create(null);
    const handlerSet = {
      handler,
      possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
      score: this.#order
    };
    m[method] = handlerSet;
    curNode.#methods.push(m);
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          if (part === "") {
            continue;
          }
          const [key, name, matcher] = pattern;
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// ../../node_modules/.pnpm/hono@4.7.7/node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.origin !== "*") {
      const existingVary = c.req.header("Vary");
      if (existingVary) {
        set("Vary", existingVary);
      } else {
        set("Vary", "Origin");
      }
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      if (opts.allowMethods?.length) {
        set("Access-Control-Allow-Methods", opts.allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
  }, "cors2");
}, "cors");

// src/json-rules-engine.ts
var JsonRulesEngine = class {
  static {
    __name(this, "JsonRulesEngine");
  }
  /**
   * Validate data against a rule set
   */
  validateRules(data, ruleSet) {
    const errors = [];
    const operator = ruleSet.operator || "and";
    let results = [];
    for (const rule of ruleSet.rules) {
      const result = this.evaluateRule(data, rule);
      if (!result.valid && result.message) {
        errors.push(result.message);
      }
      results.push(result.valid);
    }
    let isValid;
    if (operator === "and") {
      isValid = results.every((r) => r);
    } else {
      isValid = results.some((r) => r);
    }
    return {
      valid: isValid,
      errors,
      data: isValid ? data : void 0
    };
  }
  /**
   * Evaluate a single rule against data
   */
  evaluateRule(data, rule) {
    const fieldValue = this.getFieldValue(data, rule.field);
    let valid = false;
    switch (rule.operator) {
      case "required":
        valid = fieldValue !== void 0 && fieldValue !== null && fieldValue !== "";
        break;
      case "equals":
        valid = fieldValue === rule.value;
        break;
      case "not_equals":
        valid = fieldValue !== rule.value;
        break;
      case "greater_than":
        valid = typeof fieldValue === "number" && fieldValue > rule.value;
        break;
      case "greater_than_equal":
        valid = typeof fieldValue === "number" && fieldValue >= rule.value;
        break;
      case "less_than":
        valid = typeof fieldValue === "number" && fieldValue < rule.value;
        break;
      case "less_than_equal":
        valid = typeof fieldValue === "number" && fieldValue <= rule.value;
        break;
      case "min_length":
        valid = typeof fieldValue === "string" && fieldValue.length >= rule.value;
        break;
      case "max_length":
        valid = typeof fieldValue === "string" && fieldValue.length <= rule.value;
        break;
      case "contains":
        valid = typeof fieldValue === "string" && fieldValue.includes(rule.value);
        break;
      case "starts_with":
        valid = typeof fieldValue === "string" && fieldValue.startsWith(rule.value);
        break;
      case "ends_with":
        valid = typeof fieldValue === "string" && fieldValue.endsWith(rule.value);
        break;
      case "regex":
        valid = typeof fieldValue === "string" && new RegExp(rule.value).test(fieldValue);
        break;
      case "email":
        valid = typeof fieldValue === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue);
        break;
      case "url":
        valid = typeof fieldValue === "string" && this.isValidUrl(fieldValue);
        break;
      case "in":
        valid = Array.isArray(rule.value) && rule.value.includes(fieldValue);
        break;
      case "not_in":
        valid = Array.isArray(rule.value) && !rule.value.includes(fieldValue);
        break;
      default:
        valid = false;
    }
    return {
      valid,
      message: valid ? void 0 : rule.message || `${rule.field} failed ${rule.operator} validation`
    };
  }
  /**
   * Get field value from data object, supporting nested paths
   */
  getFieldValue(data, fieldPath) {
    return fieldPath.split(".").reduce((obj, key) => {
      return obj && obj[key] !== void 0 ? obj[key] : void 0;
    }, data);
  }
  /**
   * Validate URL format
   */
  isValidUrl(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Apply default values to data based on entity configuration
   */
  applyDefaults(data, config2) {
    const result = { ...data };
    if (config2.defaultValues) {
      for (const [field, defaultValue] of Object.entries(config2.defaultValues)) {
        if (result[field] === void 0) {
          result[field] = defaultValue;
        }
      }
    }
    for (const [fieldName, fieldDef] of Object.entries(config2.customFields)) {
      if (result[fieldName] === void 0 && fieldDef.default !== void 0) {
        result[fieldName] = fieldDef.default;
      }
    }
    return result;
  }
  /**
   * Validate field types and basic constraints
   */
  validateFieldTypes(data, config2) {
    const errors = [];
    for (const [fieldName, fieldDef] of Object.entries(config2.customFields)) {
      const value = data[fieldName];
      if (fieldDef.required && (value === void 0 || value === null || value === "")) {
        errors.push(`${fieldName} is required`);
        continue;
      }
      if (value === void 0 || value === null) {
        continue;
      }
      switch (fieldDef.type) {
        case "string":
          if (typeof value !== "string") {
            errors.push(`${fieldName} must be a string`);
          } else {
            if (fieldDef.minLength && value.length < fieldDef.minLength) {
              errors.push(`${fieldName} must be at least ${fieldDef.minLength} characters`);
            }
            if (fieldDef.maxLength && value.length > fieldDef.maxLength) {
              errors.push(`${fieldName} must be no more than ${fieldDef.maxLength} characters`);
            }
            if (fieldDef.pattern && !new RegExp(fieldDef.pattern).test(value)) {
              errors.push(`${fieldName} format is invalid`);
            }
          }
          break;
        case "number":
          if (typeof value !== "number" || isNaN(value)) {
            errors.push(`${fieldName} must be a number`);
          } else {
            if (fieldDef.min !== void 0 && value < fieldDef.min) {
              errors.push(`${fieldName} must be at least ${fieldDef.min}`);
            }
            if (fieldDef.max !== void 0 && value > fieldDef.max) {
              errors.push(`${fieldName} must be no more than ${fieldDef.max}`);
            }
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            errors.push(`${fieldName} must be a boolean`);
          }
          break;
        case "enum":
          if (!fieldDef.enum || !fieldDef.enum.includes(value)) {
            errors.push(`${fieldName} must be one of: ${fieldDef.enum?.join(", ")}`);
          }
          break;
        case "email":
          if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${fieldName} must be a valid email address`);
          }
          break;
        case "url":
          if (typeof value !== "string" || !this.isValidUrl(value)) {
            errors.push(`${fieldName} must be a valid URL`);
          }
          break;
        case "date":
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            errors.push(`${fieldName} must be a valid date`);
          }
          break;
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : void 0
    };
  }
  /**
   * Generate save data with proper structure
   */
  generateSaveData(data, config2) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = { ...data };
    if (!result.id) {
      result.id = "entity-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    }
    if (!result.created_at) {
      result.created_at = now;
    }
    result.updated_at = now;
    if (!result.status) {
      result.status = "draft";
    }
    return result;
  }
  /**
   * Check workflow transitions
   */
  validateWorkflowTransition(currentStatus, newStatus, config2) {
    if (!config2.workflows || !config2.workflows[currentStatus]) {
      return { valid: true, errors: [] };
    }
    const allowedTransitions = config2.workflows[currentStatus];
    const valid = allowedTransitions.includes(newStatus);
    return {
      valid,
      errors: valid ? [] : [`Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(", ")}`]
    };
  }
};

// src/primitives.ts
var BASE_PRIMITIVES = {
  Project: {
    name: "Project",
    coreFields: {
      id: "string",
      name: "string",
      description: "string",
      status: "enum",
      created_at: "date",
      updated_at: "date"
    },
    defaultStatus: "draft",
    statusTransitions: ["draft", "active", "on_hold", "completed", "cancelled"]
  },
  Task: {
    name: "Task",
    coreFields: {
      id: "string",
      title: "string",
      description: "string",
      priority: "enum",
      status: "enum",
      due_date: "date",
      assigned_to: "string",
      created_at: "date",
      updated_at: "date"
    },
    defaultStatus: "todo",
    statusTransitions: ["todo", "in_progress", "review", "done", "cancelled"]
  },
  File: {
    name: "File",
    coreFields: {
      id: "string",
      filename: "string",
      size: "number",
      type: "string",
      upload_date: "date",
      uploaded_by: "string"
    }
  },
  Discussion: {
    name: "Discussion",
    coreFields: {
      id: "string",
      title: "string",
      content: "string",
      author: "string",
      created_at: "date",
      status: "enum"
    },
    defaultStatus: "open",
    statusTransitions: ["open", "closed", "archived"]
  }
};
function getAllPrimitives() {
  return Object.values(BASE_PRIMITIVES);
}
__name(getAllPrimitives, "getAllPrimitives");

// src/d1-database-manager.ts
var D1DatabaseManager = class {
  static {
    __name(this, "D1DatabaseManager");
  }
  db;
  tables = /* @__PURE__ */ new Map();
  migrations = /* @__PURE__ */ new Map();
  constructor(env2) {
    this.db = env2.DB;
  }
  /**
   * Initialize the database with required system tables
   */
  async initialize() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS __migrations (
        id TEXT PRIMARY KEY,
        orgId TEXT NOT NULL,
        entityName TEXT NOT NULL,
        operation TEXT NOT NULL,
        sql TEXT NOT NULL,
        executedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'completed'
      )
    `).run();
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    const orgs = ["acme-corp", "techflow-solutions", "startup-inc"];
    for (const orgId of orgs) {
      await this.db.prepare(`
        INSERT OR IGNORE INTO organizations (id, name) 
        VALUES (?, ?)
      `).bind(orgId, orgId.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())).run();
    }
  }
  /**
   * Create a new organization-specific table with real D1 execution
   */
  async createOrgTable(config2) {
    const tableName = `${config2.orgId.replace(/-/g, "_")}_${config2.name.toLowerCase()}s`;
    const tableKey = `${config2.orgId}:${config2.name}`;
    const baseColumns = this.getBaseColumns(config2.basePrimitive);
    const customColumns = this.generateCustomColumns(config2.customFields);
    const allColumns = [
      ...baseColumns,
      ...customColumns,
      // JSON column for future fields (SQLite uses TEXT for JSON)
      {
        name: "custom_data",
        type: "TEXT",
        nullable: false,
        default: "'{}'"
      },
      // Organization isolation
      {
        name: "organization_id",
        type: "TEXT",
        nullable: false
      }
    ];
    const indexes = this.generateIndexes(tableName, config2);
    const table3 = {
      name: tableName,
      columns: allColumns,
      indexes,
      constraints: [],
      // SQLite constraints are inline
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      orgId: config2.orgId,
      entityName: config2.name
    };
    const migration = this.generateCreateTableMigration(table3);
    await this.executeMigration(migration);
    this.tables.set(tableKey, table3);
    return table3;
  }
  /**
   * Add a custom field to existing table with real D1 execution
   */
  async addCustomField(orgId, entityName, fieldName, fieldConfig) {
    const tableKey = `${orgId}:${entityName}`;
    const table3 = this.tables.get(tableKey);
    if (!table3) {
      throw new Error(`Table not found: ${tableKey}`);
    }
    const column = this.generateColumnFromField(fieldName, fieldConfig);
    const migration = {
      id: `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      entityName,
      operation: "add_column",
      sql: `ALTER TABLE ${table3.name} ADD COLUMN ${column.name} ${column.type}${column.nullable ? "" : " NOT NULL"}${column.default ? ` DEFAULT ${column.default}` : ""};`,
      status: "pending"
    };
    await this.executeMigration(migration);
    table3.columns.push(column);
    this.tables.set(tableKey, table3);
    return migration;
  }
  /**
   * Get base columns for a primitive type (SQLite types)
   */
  getBaseColumns(primitive) {
    const baseColumns = [
      {
        name: "id",
        type: "TEXT PRIMARY KEY",
        nullable: false,
        default: void 0
        // SQLite will auto-generate if we use rowid, but we'll use UUIDs
      },
      {
        name: "created_at",
        type: "DATETIME",
        nullable: false,
        default: "CURRENT_TIMESTAMP"
      },
      {
        name: "updated_at",
        type: "DATETIME",
        nullable: false,
        default: "CURRENT_TIMESTAMP"
      }
    ];
    switch (primitive) {
      case "Project":
        return [
          ...baseColumns,
          {
            name: "name",
            type: "TEXT",
            nullable: false
          },
          {
            name: "description",
            type: "TEXT",
            nullable: true
          },
          {
            name: "status",
            type: "TEXT",
            nullable: false,
            default: "'draft'"
          }
        ];
      case "Task":
        return [
          ...baseColumns,
          {
            name: "title",
            type: "TEXT",
            nullable: false
          },
          {
            name: "description",
            type: "TEXT",
            nullable: true
          },
          {
            name: "priority",
            type: "TEXT",
            nullable: false,
            default: "'medium'"
          },
          {
            name: "status",
            type: "TEXT",
            nullable: false,
            default: "'todo'"
          },
          {
            name: "due_date",
            type: "DATE",
            nullable: true
          },
          {
            name: "assigned_to",
            type: "TEXT",
            nullable: true
          }
        ];
      default:
        return baseColumns;
    }
  }
  /**
   * Generate custom columns from field definitions (SQLite types)
   */
  generateCustomColumns(customFields) {
    return Object.entries(customFields).map(
      ([fieldName, fieldDef]) => this.generateColumnFromField(fieldName, fieldDef)
    );
  }
  /**
   * Generate database column from field definition (SQLite compatible)
   */
  generateColumnFromField(fieldName, fieldDef) {
    const columnName = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
    let type;
    let constraint;
    switch (fieldDef.type) {
      case "string":
        type = "TEXT";
        if (fieldDef.minLength || fieldDef.maxLength) {
          const checks = [];
          if (fieldDef.minLength) checks.push(`LENGTH(${columnName}) >= ${fieldDef.minLength}`);
          if (fieldDef.maxLength) checks.push(`LENGTH(${columnName}) <= ${fieldDef.maxLength}`);
          if (checks.length > 0) {
            constraint = `CHECK (${checks.join(" AND ")})`;
          }
        }
        break;
      case "number":
        type = "INTEGER";
        if (fieldDef.min !== void 0 || fieldDef.max !== void 0) {
          const checks = [];
          if (fieldDef.min !== void 0) checks.push(`${columnName} >= ${fieldDef.min}`);
          if (fieldDef.max !== void 0) checks.push(`${columnName} <= ${fieldDef.max}`);
          if (checks.length > 0) {
            constraint = `CHECK (${checks.join(" AND ")})`;
          }
        }
        break;
      case "boolean":
        type = "INTEGER";
        constraint = `CHECK (${columnName} IN (0, 1))`;
        break;
      case "date":
        type = "DATE";
        break;
      case "email":
        type = "TEXT";
        constraint = `CHECK (${columnName} LIKE '%@%.%')`;
        break;
      case "url":
        type = "TEXT";
        constraint = `CHECK (${columnName} LIKE 'http%://%')`;
        break;
      case "enum":
        type = "TEXT";
        if (fieldDef.enum && fieldDef.enum.length > 0) {
          const values = fieldDef.enum.map((v) => `'${v}'`).join(", ");
          constraint = `CHECK (${columnName} IN (${values}))`;
        }
        break;
      case "array":
        type = "TEXT";
        constraint = `CHECK (json_valid(${columnName}))`;
        break;
      default:
        type = "TEXT";
    }
    let defaultValue;
    if (fieldDef.default !== void 0) {
      if (fieldDef.type === "boolean") {
        defaultValue = fieldDef.default ? "1" : "0";
      } else if (fieldDef.type === "array") {
        defaultValue = `'${JSON.stringify(fieldDef.default)}'`;
      } else {
        defaultValue = `'${fieldDef.default}'`;
      }
    }
    return {
      name: columnName,
      type: constraint ? `${type} ${constraint}` : type,
      nullable: !fieldDef.required,
      default: defaultValue,
      constraint
    };
  }
  /**
   * Generate indexes for the table (SQLite compatible)
   */
  generateIndexes(tableName, config2) {
    const safeTableName = tableName.replace(/-/g, "_");
    const indexes = [
      // Organization isolation index
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_org_id_idx ON ${safeTableName} (organization_id);`,
      // Status index (common query pattern)
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_status_idx ON ${safeTableName} (status);`,
      // Created date index
      `CREATE INDEX IF NOT EXISTS ${safeTableName}_created_at_idx ON ${safeTableName} (created_at);`
    ];
    Object.entries(config2.customFields).forEach(([fieldName, fieldDef]) => {
      if (fieldDef.indexed) {
        const columnName = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
        indexes.push(`CREATE INDEX IF NOT EXISTS ${safeTableName}_${columnName}_idx ON ${safeTableName} (${columnName});`);
      }
    });
    return indexes;
  }
  /**
   * Generate CREATE TABLE migration (SQLite compatible)
   */
  generateCreateTableMigration(table3) {
    const columnDefs = table3.columns.map((col) => {
      let def = `  ${col.name} ${col.type}`;
      if (!col.nullable && !col.type.includes("PRIMARY KEY")) def += " NOT NULL";
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    }).join(",\n");
    let sql = `CREATE TABLE ${table3.name} (
${columnDefs}
);`;
    if (table3.indexes.length > 0) {
      sql += "\n\n-- Indexes\n" + table3.indexes.join("\n");
    }
    return {
      id: `migration_${Date.now()}_create_${table3.name}`,
      orgId: table3.orgId,
      entityName: table3.entityName,
      operation: "create_table",
      sql,
      status: "pending"
    };
  }
  /**
   * Execute a migration using real D1 database
   */
  async executeMigration(migration) {
    migration.status = "executing";
    this.migrations.set(migration.id, migration);
    try {
      console.log(`Executing D1 migration: ${migration.id}`);
      console.log(`SQL: ${migration.sql}`);
      const statements = migration.sql.split(/;\s*(?=\n|$)/).filter((stmt) => stmt.trim().length > 0);
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt) {
          await this.db.prepare(trimmedStmt).run();
        }
      }
      migration.status = "completed";
      migration.executedAt = (/* @__PURE__ */ new Date()).toISOString();
      await this.db.prepare(`
        INSERT INTO __migrations (id, orgId, entityName, operation, sql, executedAt, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        migration.id,
        migration.orgId,
        migration.entityName,
        migration.operation,
        migration.sql,
        migration.executedAt,
        migration.status
      ).run();
      console.log(`\u2705 D1 Migration completed: ${migration.id}`);
    } catch (error3) {
      migration.status = "failed";
      migration.error = error3 instanceof Error ? error3.message : "Unknown error";
      try {
        await this.db.prepare(`
          INSERT INTO __migrations (id, orgId, entityName, operation, sql, status) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          migration.id,
          migration.orgId,
          migration.entityName,
          migration.operation,
          migration.sql,
          "failed"
        ).run();
      } catch (recordError) {
        console.error("Failed to record migration failure:", recordError);
      }
      console.log(`\u274C D1 Migration failed: ${migration.id} - ${migration.error}`);
      throw error3;
    } finally {
      this.migrations.set(migration.id, migration);
    }
  }
  /**
   * Insert data into a table
   */
  async insertRecord(tableName, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(data);
    try {
      const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      console.log(`D1 Insert SQL: ${sql}`);
      console.log(`D1 Insert Values:`, values);
      const result = await this.db.prepare(sql).bind(...values).first();
      return result;
    } catch (error3) {
      console.error(`D1 Insert Error for ${tableName}:`, error3);
      console.error(`Insert data:`, data);
      throw error3;
    }
  }
  /**
   * Query data from a table
   */
  async queryRecords(tableName, where = {}, limit = 100) {
    let sql = `SELECT * FROM ${tableName}`;
    const values = [];
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map((key) => `${key} = ?`).join(" AND ");
      sql += ` WHERE ${conditions}`;
      values.push(...Object.values(where));
    }
    sql += ` LIMIT ${limit}`;
    const result = await this.db.prepare(sql).bind(...values).all();
    return result.results || [];
  }
  /**
   * Get table information from SQLite schema
   */
  async getTableInfo(tableName) {
    const result = await this.db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`
    ).bind(tableName).first();
    return result;
  }
  /**
   * Get all tables for an organization
   */
  getOrgTables(orgId) {
    return Array.from(this.tables.values()).filter((table3) => table3.orgId === orgId);
  }
  /**
   * Get all migrations for an organization
   */
  getOrgMigrations(orgId) {
    return Array.from(this.migrations.values()).filter((migration) => migration.orgId === orgId);
  }
  /**
   * Get all tables across all organizations
   */
  getAllTables() {
    return Array.from(this.tables.values());
  }
  /**
   * Get all migrations across all organizations
   */
  getAllMigrations() {
    return Array.from(this.migrations.values());
  }
  /**
   * Get migrations from database
   */
  async getStoredMigrations() {
    const result = await this.db.prepare(
      `SELECT * FROM __migrations ORDER BY executedAt DESC`
    ).all();
    return (result.results || []).map((row) => ({
      id: row.id,
      orgId: row.orgId,
      entityName: row.entityName,
      operation: row.operation,
      sql: row.sql,
      executedAt: row.executedAt,
      status: row.status
    }));
  }
  /**
   * Generate database schema report with real D1 data
   */
  async generateSchemaReport() {
    const storedMigrations = await this.getStoredMigrations();
    const tablesByOrg = {};
    const migrationsByOrg = {};
    this.getAllTables().forEach((table3) => {
      if (!tablesByOrg[table3.orgId]) {
        tablesByOrg[table3.orgId] = [];
      }
      tablesByOrg[table3.orgId].push(table3);
    });
    [...this.getAllMigrations(), ...storedMigrations].forEach((migration) => {
      if (!migrationsByOrg[migration.orgId]) {
        migrationsByOrg[migration.orgId] = [];
      }
      migrationsByOrg[migration.orgId].push(migration);
    });
    const actualTables = await this.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__migrations' AND name != 'organizations'`
    ).all();
    return {
      summary: {
        totalOrganizations: Object.keys(tablesByOrg).length,
        totalTables: this.getAllTables().length,
        actualTablesInD1: actualTables.results?.length || 0,
        totalMigrations: [...this.getAllMigrations(), ...storedMigrations].length,
        completedMigrations: [...this.getAllMigrations(), ...storedMigrations].filter((m) => m.status === "completed").length
      },
      organizations: Object.keys(tablesByOrg).map((orgId) => ({
        orgId,
        tables: tablesByOrg[orgId]?.length || 0,
        migrations: migrationsByOrg[orgId]?.length || 0,
        entities: tablesByOrg[orgId]?.map((t) => t.entityName) || []
      })),
      actualTables: actualTables.results?.map((t) => t.name) || [],
      tables: tablesByOrg,
      migrations: migrationsByOrg,
      storedMigrations: storedMigrations.slice(0, 10)
      // Latest 10 migrations
    };
  }
};

// src/type-generator.ts
var TypeGenerator = class {
  static {
    __name(this, "TypeGenerator");
  }
  generatedTypes = /* @__PURE__ */ new Map();
  /**
   * Generate TypeScript types for an entity configuration
   */
  generateEntityTypes(config2, table3) {
    const typeKey = `${config2.orgId}:${config2.name}`;
    const interfaceCode = this.generateInterface(config2, table3);
    const apiHelperCode = this.generateApiHelper(config2);
    const validationHelperCode = this.generateValidationHelper(config2);
    const generatedType = {
      orgId: config2.orgId,
      entityName: config2.name,
      interface: interfaceCode,
      apiHelper: apiHelperCode,
      validationHelper: validationHelperCode,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.generatedTypes.set(typeKey, generatedType);
    return generatedType;
  }
  /**
   * Generate TypeScript interface
   */
  generateInterface(config2, table3) {
    const baseFields = this.getBaseInterfaceFields(config2.basePrimitive);
    const customFields = this.generateCustomFields(config2.customFields);
    return `// Generated TypeScript interface for ${config2.name}
// Organization: ${config2.orgId}
// Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}

export interface ${config2.name} {
${baseFields.map((field) => `  ${field}`).join("\n")}
${customFields.map((field) => `  ${field}`).join("\n")}
  
  // System fields
  organization_id: string;
  custom_data?: Record<string, any>;
}

export interface ${config2.name}CreateInput {
${baseFields.filter((f) => !f.includes("id:") && !f.includes("created_at:") && !f.includes("updated_at:")).map((field) => `  ${field}`).join("\n")}
${customFields.map((field) => `  ${field}`).join("\n")}
}

export interface ${config2.name}UpdateInput {
${baseFields.filter((f) => !f.includes("id:") && !f.includes("created_at:")).map((field) => `  ${field.replace(/:/g, "?:")}}`).join("\n")}
${customFields.map((field) => `  ${field.replace(/:/g, "?:")}`).join("\n")}
}

export interface ${config2.name}Query {
${baseFields.map((field) => `  ${field.replace(/:/g, "?:")}}`).join("\n")}
${customFields.map((field) => `  ${field.replace(/:/g, "?:")}`).join("\n")}
}`;
  }
  /**
   * Get base interface fields for primitive type
   */
  getBaseInterfaceFields(primitive) {
    const baseFields = [
      "id: string",
      "created_at: Date",
      "updated_at: Date"
    ];
    switch (primitive) {
      case "Project":
        return [
          ...baseFields,
          "name: string",
          "description?: string",
          'status: "draft" | "active" | "on_hold" | "completed" | "cancelled"'
        ];
      case "Task":
        return [
          ...baseFields,
          "title: string",
          "description?: string",
          'priority: "low" | "medium" | "high" | "urgent"',
          'status: "todo" | "in_progress" | "review" | "done" | "cancelled"',
          "due_date?: Date",
          "assigned_to?: string"
        ];
      default:
        return baseFields;
    }
  }
  /**
   * Generate custom field type definitions
   */
  generateCustomFields(customFields) {
    return Object.entries(customFields).map(([fieldName, fieldDef]) => {
      let type = this.getTypeScriptType(fieldDef);
      const optional = fieldDef.required ? "" : "?";
      return `${fieldName}${optional}: ${type}`;
    });
  }
  /**
   * Convert field definition to TypeScript type
   */
  getTypeScriptType(fieldDef) {
    switch (fieldDef.type) {
      case "string":
      case "email":
      case "url":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "date":
        return "Date";
      case "enum":
        if (fieldDef.enum && fieldDef.enum.length > 0) {
          return fieldDef.enum.map((v) => `"${v}"`).join(" | ");
        }
        return "string";
      case "array":
        const itemType = fieldDef.items || "any";
        return `${this.getTypeScriptType({ type: itemType })}[]`;
      default:
        return "any";
    }
  }
  /**
   * Generate API helper code
   */
  generateApiHelper(config2) {
    return `// Generated API helpers for ${config2.name}
// Organization: ${config2.orgId}

const BASE_URL = '/entity/${config2.orgId}/${config2.name}';

export class ${config2.name}API {
  /**
   * Validate entity data against business rules
   */
  static async validate(data: ${config2.name}CreateInput): Promise<{
    valid: boolean;
    errors: string[];
    data?: ${config2.name}CreateInput;
  }> {
    const response = await fetch(\`\${BASE_URL}/validate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Save new entity
   */
  static async create(data: ${config2.name}CreateInput): Promise<{
    success: boolean;
    data?: ${config2.name};
    errors?: string[];
  }> {
    const response = await fetch(\`\${BASE_URL}/save\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Update existing entity
   */
  static async update(id: string, data: ${config2.name}UpdateInput): Promise<{
    success: boolean;
    data?: ${config2.name};
    errors?: string[];
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Query entities with filters
   */
  static async query(filters: ${config2.name}Query = {}): Promise<{
    success: boolean;
    data?: ${config2.name}[];
    total?: number;
  }> {
    const response = await fetch(\`\${BASE_URL}/query\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    
    return response.json();
  }

  /**
   * Get entity by ID
   */
  static async getById(id: string): Promise<{
    success: boolean;
    data?: ${config2.name};
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'GET'
    });
    
    return response.json();
  }

  /**
   * Delete entity
   */
  static async delete(id: string): Promise<{
    success: boolean;
  }> {
    const response = await fetch(\`\${BASE_URL}/\${id}\`, {
      method: 'DELETE'
    });
    
    return response.json();
  }
}`;
  }
  /**
   * Generate validation helper code
   */
  generateValidationHelper(config2) {
    const validationRules = config2.validationRules || { rules: [] };
    return `// Generated validation helpers for ${config2.name}
// Organization: ${config2.orgId}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ${config2.name}Validator {
  /**
   * Client-side validation (mirrors server-side rules)
   */
  static validate(data: Partial<${config2.name}>): ValidationResult {
    const errors: string[] = [];

    ${this.generateValidationCode(config2.customFields, validationRules)}

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual field
   */
  static validateField(fieldName: keyof ${config2.name}, value: any): ValidationResult {
    const errors: string[] = [];

    switch (fieldName) {
${Object.entries(config2.customFields).map(
      ([fieldName, fieldDef]) => this.generateFieldValidation(fieldName, fieldDef)
    ).join("\n")}
      default:
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get field constraints
   */
  static getFieldConstraints(): Record<string, any> {
    return ${JSON.stringify(config2.customFields, null, 4)};
  }

  /**
   * Get validation rules
   */
  static getValidationRules(): any {
    return ${JSON.stringify(validationRules, null, 4)};
  }
}`;
  }
  /**
   * Generate validation code for all fields
   */
  generateValidationCode(customFields, validationRules) {
    const fieldValidations = Object.entries(customFields).map(([fieldName, fieldDef]) => {
      const validations = [];
      if (fieldDef.required) {
        validations.push(`
    if (!data.${fieldName}) {
      errors.push('${fieldName} is required');
    }`);
      }
      if (fieldDef.type === "string") {
        if (fieldDef.minLength) {
          validations.push(`
    if (data.${fieldName} && data.${fieldName}.length < ${fieldDef.minLength}) {
      errors.push('${fieldName} must be at least ${fieldDef.minLength} characters');
    }`);
        }
        if (fieldDef.maxLength) {
          validations.push(`
    if (data.${fieldName} && data.${fieldName}.length > ${fieldDef.maxLength}) {
      errors.push('${fieldName} must be no more than ${fieldDef.maxLength} characters');
    }`);
        }
      }
      if (fieldDef.type === "number") {
        if (fieldDef.min !== void 0) {
          validations.push(`
    if (data.${fieldName} !== undefined && data.${fieldName} < ${fieldDef.min}) {
      errors.push('${fieldName} must be at least ${fieldDef.min}');
    }`);
        }
        if (fieldDef.max !== void 0) {
          validations.push(`
    if (data.${fieldName} !== undefined && data.${fieldName} > ${fieldDef.max}) {
      errors.push('${fieldName} must be no more than ${fieldDef.max}');
    }`);
        }
      }
      if (fieldDef.type === "email") {
        validations.push(`
    if (data.${fieldName} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${fieldName})) {
      errors.push('${fieldName} must be a valid email address');
    }`);
      }
      if (fieldDef.type === "url") {
        validations.push(`
    if (data.${fieldName}) {
      try { new URL(data.${fieldName}); } 
      catch { errors.push('${fieldName} must be a valid URL'); }
    }`);
      }
      if (fieldDef.type === "enum" && fieldDef.enum) {
        const enumValues = fieldDef.enum.map((v) => `'${v}'`).join(", ");
        validations.push(`
    if (data.${fieldName} && ![${enumValues}].includes(data.${fieldName})) {
      errors.push('${fieldName} must be one of: ${fieldDef.enum.join(", ")}');
    }`);
      }
      return validations.join("");
    }).join("");
    const businessRules = validationRules.rules?.map((rule) => {
      const condition = this.generateRuleCondition(rule);
      return `
    if (data.${rule.field} !== undefined && !(${condition})) {
      errors.push('${rule.message || `${rule.field} failed ${rule.operator} validation`}');
    }`;
    }).join("") || "";
    return fieldValidations + businessRules;
  }
  /**
   * Generate field-specific validation
   */
  generateFieldValidation(fieldName, fieldDef) {
    return `      case '${fieldName}':
        // Field type: ${fieldDef.type}
        if (value !== undefined) {
          // Add specific validation logic here
        }
        break;`;
  }
  /**
   * Generate rule condition for business rules
   */
  generateRuleCondition(rule) {
    const field = `data.${rule.field}`;
    switch (rule.operator) {
      case "greater_than":
        return `${field} > ${rule.value}`;
      case "greater_than_equal":
        return `${field} >= ${rule.value}`;
      case "less_than":
        return `${field} < ${rule.value}`;
      case "less_than_equal":
        return `${field} <= ${rule.value}`;
      case "equals":
        return `${field} === '${rule.value}'`;
      case "not_equals":
        return `${field} !== '${rule.value}'`;
      case "starts_with":
        return `${field}.startsWith('${rule.value}')`;
      case "ends_with":
        return `${field}.endsWith('${rule.value}')`;
      case "contains":
        return `${field}.includes('${rule.value}')`;
      case "min_length":
        return `${field}.length >= ${rule.value}`;
      case "max_length":
        return `${field}.length <= ${rule.value}`;
      default:
        return "true";
    }
  }
  /**
   * Get all generated types for an organization
   */
  getOrgTypes(orgId) {
    return Array.from(this.generatedTypes.values()).filter((type) => type.orgId === orgId);
  }
  /**
   * Get all generated types
   */
  getAllTypes() {
    return Array.from(this.generatedTypes.values());
  }
  /**
   * Generate type generation report
   */
  generateReport() {
    const allTypes = this.getAllTypes();
    const organizationSummary = {};
    allTypes.forEach((type) => {
      organizationSummary[type.orgId] = (organizationSummary[type.orgId] || 0) + 1;
    });
    return {
      totalTypes: allTypes.length,
      organizationSummary,
      generatedFiles: allTypes
    };
  }
};

// src/rules-factory.ts
var RulesFactory = class {
  static {
    __name(this, "RulesFactory");
  }
  rulesEngine;
  env;
  databaseManager;
  typeGenerator;
  constructor(env2) {
    this.env = env2;
    this.rulesEngine = new JsonRulesEngine();
    this.databaseManager = new D1DatabaseManager(env2);
    this.typeGenerator = new TypeGenerator();
  }
  /**
   * Deploy entity configuration with validation rules
   */
  async deployEntity(entityConfig) {
    const primitive = this.getPrimitive(entityConfig.basePrimitive);
    if (!primitive) {
      throw new Error(`Unknown primitive: ${entityConfig.basePrimitive}`);
    }
    await this.databaseManager.initialize();
    const table3 = await this.databaseManager.createOrgTable(entityConfig);
    const generatedTypes = this.typeGenerator.generateEntityTypes(entityConfig, table3);
    const schema = {
      definition: entityConfig,
      primitive,
      tableName: table3.name,
      table: table3,
      generatedTypes,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: 1
    };
    const configKey = `config:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_CONFIG.put(configKey, JSON.stringify(entityConfig));
    const schemaKey = `schema:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_SCHEMAS.put(schemaKey, JSON.stringify(schema));
    const tableKey = `table:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_CONFIG.put(tableKey, table3.name);
    return schema;
  }
  /**
   * Execute validation operation using rules engine
   */
  async executeValidation(orgId, entityName, data) {
    const config2 = await this.getEntityConfig(orgId, entityName);
    if (!config2) {
      return { valid: false, errors: ["Entity configuration not found"] };
    }
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, config2);
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, config2);
    if (!typeValidation.valid) {
      return typeValidation;
    }
    if (config2.validationRules && config2.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, config2.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }
    return { valid: true, errors: [], data: dataWithDefaults };
  }
  /**
   * Execute save operation with validation and data transformation
   */
  async executeSave(orgId, entityName, data) {
    const validation = await this.executeValidation(orgId, entityName, data);
    if (!validation.valid || !validation.data) {
      return validation;
    }
    const config2 = await this.getEntityConfig(orgId, entityName);
    if (!config2) {
      return { valid: false, errors: ["Entity configuration not found"] };
    }
    const saveData = this.rulesEngine.generateSaveData(validation.data, config2);
    if (data.status && data._currentStatus) {
      const workflowValidation = this.rulesEngine.validateWorkflowTransition(
        data._currentStatus,
        data.status,
        config2
      );
      if (!workflowValidation.valid) {
        return workflowValidation;
      }
    }
    return { valid: true, errors: [], data: saveData };
  }
  /**
   * Execute query operation (returns query configuration)
   */
  async executeQuery(orgId, entityName, filters = {}) {
    const config2 = await this.getEntityConfig(orgId, entityName);
    if (!config2) {
      return { valid: false, errors: ["Entity configuration not found"] };
    }
    const primitive = this.getPrimitive(config2.basePrimitive);
    const queryConfig = {
      table: `${orgId}_${entityName.toLowerCase()}s`,
      filters,
      coreFields: Object.keys(primitive?.coreFields || {}),
      customFields: Object.keys(config2.customFields || {}),
      allowedFilters: this.generateAllowedFilters(config2)
    };
    return { valid: true, errors: [], data: queryConfig };
  }
  /**
   * Get entity configuration from KV storage
   */
  async getEntityConfig(orgId, entityName) {
    const configKey = `config:${orgId}:${entityName}`;
    const configJson = await this.env.ENTITY_CONFIG.get(configKey);
    if (!configJson) {
      return null;
    }
    try {
      return JSON.parse(configJson);
    } catch {
      return null;
    }
  }
  /**
   * Get entity schema from KV storage
   */
  async getEntitySchema(orgId, entityName) {
    const schemaKey = `schema:${orgId}:${entityName}`;
    const schemaJson = await this.env.ENTITY_SCHEMAS.get(schemaKey);
    if (!schemaJson) {
      return null;
    }
    try {
      return JSON.parse(schemaJson);
    } catch {
      return null;
    }
  }
  /**
   * List all entities for an organization
   */
  async listOrgEntities(orgId) {
    const prefix = `config:${orgId}:`;
    const list = await this.env.ENTITY_CONFIG.list({ prefix });
    return list.keys.map((key) => key.name.replace(prefix, "")).filter((name) => !name.startsWith("table:"));
  }
  /**
   * List all stored configurations for debugging
   */
  async debugConfigurations() {
    const configList = await this.env.ENTITY_CONFIG.list();
    const schemasList = await this.env.ENTITY_SCHEMAS.list();
    return {
      configurations: configList.keys.map((k) => k.name),
      schemas: schemasList.keys.map((k) => k.name),
      total: configList.keys.length + schemasList.keys.length
    };
  }
  /**
   * Get specific configuration for debugging
   */
  async getConfiguration(key) {
    const config2 = await this.env.ENTITY_CONFIG.get(key);
    const schema = await this.env.ENTITY_SCHEMAS.get(key);
    return {
      key,
      config: config2 ? JSON.parse(config2) : null,
      schema: schema ? JSON.parse(schema) : null
    };
  }
  /**
   * Add custom field to existing entity
   */
  async addCustomField(orgId, entityName, fieldName, fieldConfig) {
    const migration = await this.databaseManager.addCustomField(orgId, entityName, fieldName, fieldConfig);
    const config2 = await this.getEntityConfig(orgId, entityName);
    if (config2) {
      config2.customFields[fieldName] = fieldConfig;
      const configKey = `config:${orgId}:${entityName}`;
      await this.env.ENTITY_CONFIG.put(configKey, JSON.stringify(config2));
      const table3 = this.databaseManager.getOrgTables(orgId).find((t) => t.entityName === entityName);
      if (table3) {
        const generatedTypes = this.typeGenerator.generateEntityTypes(config2, table3);
        return { migration, generatedTypes };
      }
    }
    return { migration };
  }
  /**
   * Get database schema report
   */
  async getDatabaseReport() {
    return await this.databaseManager.generateSchemaReport();
  }
  /**
   * Get type generation report
   */
  getTypeGenerationReport() {
    return this.typeGenerator.generateReport();
  }
  /**
   * Get comprehensive multi-org report
   */
  async getMultiOrgReport() {
    const databaseReport = await this.getDatabaseReport();
    const typeReport = this.getTypeGenerationReport();
    const configReport = this.getConfigurationReport();
    return {
      summary: {
        totalOrganizations: databaseReport.summary.totalOrganizations,
        totalTables: databaseReport.summary.totalTables,
        actualTablesInD1: databaseReport.summary.actualTablesInD1,
        totalMigrations: databaseReport.summary.totalMigrations,
        completedMigrations: databaseReport.summary.completedMigrations,
        totalGeneratedTypes: typeReport.totalTypes,
        totalConfigurations: configReport.totalConfigurations
      },
      database: databaseReport,
      types: typeReport,
      configurations: configReport,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Get configuration report
   */
  getConfigurationReport() {
    const organizations = ["acme-corp", "techflow-solutions", "startup-inc"];
    const entities = ["SoftwareProject", "MarketingCampaign", "UserStory", "BugReport"];
    return {
      totalConfigurations: organizations.length * 2,
      // Simulate 2 entities per org
      organizations: organizations.map((orgId) => ({
        orgId,
        entities: entities.slice(0, 2),
        // Each org has 2 entities
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }))
    };
  }
  /**
   * Get primitive definition
   */
  getPrimitive(primitiveName) {
    const primitives = getAllPrimitives();
    return primitives.find((p) => p.name === primitiveName);
  }
  /**
   * Generate allowed query filters based on entity configuration
   */
  generateAllowedFilters(config2) {
    const primitive = this.getPrimitive(config2.basePrimitive);
    const coreFields = Object.keys(primitive?.coreFields || {});
    const customFields = Object.keys(config2.customFields || {});
    return [...coreFields, ...customFields];
  }
};
var SAMPLE_CONFIGS = {
  SoftwareProject: {
    name: "SoftwareProject",
    orgId: "acme-corp",
    basePrimitive: "Project",
    customFields: {
      budget: { type: "number", required: true, min: 1e3 },
      technology: { type: "enum", required: true, enum: ["React", "Vue", "Angular", "Svelte"] },
      repository_url: { type: "url", required: false },
      team_lead_email: { type: "email", required: true }
    },
    validationRules: {
      rules: [
        { field: "budget", operator: "greater_than_equal", value: 5e3, message: "Budget must be at least $5,000 for software projects" },
        { field: "name", operator: "min_length", value: 3, message: "Project name must be at least 3 characters" },
        { field: "repository_url", operator: "starts_with", value: "https://github.com/", message: "Repository must be a GitHub URL" }
      ],
      operator: "and"
    },
    workflows: {
      draft: ["active", "cancelled"],
      active: ["on_hold", "completed"],
      on_hold: ["active", "cancelled"],
      completed: [],
      cancelled: []
    },
    defaultValues: {
      status: "draft",
      technology: "React"
    }
  },
  MarketingCampaign: {
    name: "MarketingCampaign",
    orgId: "acme-corp",
    basePrimitive: "Project",
    customFields: {
      target_audience: { type: "string", required: true, minLength: 10 },
      budget: { type: "number", required: true, min: 100 },
      platform: { type: "enum", required: true, enum: ["Facebook", "Google", "LinkedIn", "Twitter", "Instagram"] },
      conversion_goal: { type: "string", required: false }
    },
    validationRules: {
      rules: [
        { field: "target_audience", operator: "min_length", value: 20, message: "Target audience description must be at least 20 characters" },
        { field: "budget", operator: "greater_than", value: 500, message: "Marketing campaigns require minimum $500 budget" },
        { field: "name", operator: "contains", value: "Campaign", message: 'Campaign name must contain the word "Campaign"' }
      ],
      operator: "and"
    },
    workflows: {
      draft: ["active", "cancelled"],
      active: ["paused", "completed"],
      paused: ["active", "cancelled"],
      completed: [],
      cancelled: []
    },
    defaultValues: {
      status: "draft",
      platform: "Facebook"
    }
  }
};

// src/organization-durable-object.ts
import { DurableObject } from "cloudflare:workers";
var OrganizationDurableObject = class extends DurableObject {
  static {
    __name(this, "OrganizationDurableObject");
  }
  orgId;
  config;
  entities = /* @__PURE__ */ new Map();
  storage;
  rulesEngine;
  stats;
  constructor(env2, ctx) {
    super(env2, ctx);
    this.storage = ctx.storage;
    this.rulesEngine = new JsonRulesEngine();
    this.stats = {
      requestCount: 0,
      lastRequestTime: Date.now(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request) {
    this.stats.requestCount++;
    this.stats.lastRequestTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/initialize" && request.method === "POST") {
        const config2 = await request.json();
        return this.handleInitialize(config2);
      }
      if (path === "/deploy-entity" && request.method === "POST") {
        const entityConfig = await request.json();
        return this.handleDeployEntity(entityConfig);
      }
      if (path.startsWith("/entity/") && request.method === "POST") {
        const pathParts = path.split("/");
        const entityName = pathParts[2];
        const operation = pathParts[3];
        const data = await request.json();
        return this.handleEntityOperation(entityName, operation, data);
      }
      if (path === "/stats" && request.method === "GET") {
        return this.handleGetStats();
      }
      if (path === "/entities" && request.method === "GET") {
        return this.handleListEntities();
      }
      if (path.startsWith("/entity/") && path.includes("/records") && request.method === "GET") {
        const entityName = path.split("/")[2];
        const searchParams = url.searchParams;
        return this.handleGetRecords(entityName, searchParams);
      }
      if (path === "/broadcast" && request.method === "POST") {
        const message = await request.json();
        return this.handleBroadcast(message);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error3) {
      console.error("OrganizationDurableObject error:", error3);
      return new Response(JSON.stringify({
        error: error3 instanceof Error ? error3.message : "Unknown error",
        objectId: this.orgId
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
  /**
   * Initialize the organization with configuration
   */
  async handleInitialize(config2) {
    this.orgId = config2.orgId;
    this.config = config2;
    await this.storage.put("org-config", config2);
    await this.storage.put("org-metadata", {
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: 1,
      entityCount: 0,
      totalRecords: 0
    });
    console.log(`\u{1F3E2} OrganizationDurableObject initialized: ${this.orgId}`);
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      isolationLevel: config2.isolationLevel,
      message: "Organization initialized successfully"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Deploy an entity to this organization
   */
  async handleDeployEntity(entityConfig) {
    const entityName = entityConfig.name;
    await this.storage.put(`entity:${entityName}`, entityConfig);
    this.entities.set(entityName, entityConfig);
    const metadata = await this.storage.get("org-metadata") || { entityCount: 0 };
    metadata.entityCount++;
    metadata.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.put("org-metadata", metadata);
    if (this.config?.isolationLevel === "entity-level") {
      await this.spawnEntityDurableObject(entityConfig);
    }
    console.log(`\u{1F4E6} Entity deployed to OrganizationDurableObject[${this.orgId}]: ${entityName}`);
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entityName,
      isolationLevel: this.config?.isolationLevel || "org-level",
      message: "Entity deployed successfully"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Execute entity operations (validate, save, query)
   */
  async handleEntityOperation(entityName, operation, data) {
    const entityConfig = await this.storage.get(`entity:${entityName}`);
    if (!entityConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Entity '${entityName}' not found in organization '${this.orgId}'`
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    let result;
    switch (operation) {
      case "validate":
        result = await this.validateData(entityConfig, data);
        break;
      case "save":
        result = await this.saveData(entityConfig, data);
        break;
      case "query":
        result = await this.queryData(entityConfig, data);
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown operation: ${operation}`
        }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const responseStatus = result.valid ? 200 : 400;
    return new Response(JSON.stringify({
      success: result.valid,
      ...result,
      orgId: this.orgId,
      entityName,
      approach: "durable-objects",
      isolationLevel: this.config?.isolationLevel
    }), { status: responseStatus, headers: { "Content-Type": "application/json" } });
  }
  /**
   * Validate data against entity rules
   */
  async validateData(entityConfig, data) {
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, entityConfig);
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, entityConfig);
    if (!typeValidation.valid) {
      return typeValidation;
    }
    if (entityConfig.validationRules && entityConfig.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, entityConfig.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }
    return { valid: true, errors: [], data: dataWithDefaults };
  }
  /**
   * Save data with persistent storage
   */
  async saveData(entityConfig, data) {
    const validation = await this.validateData(entityConfig, data);
    if (!validation.valid || !validation.data) {
      return validation;
    }
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...validation.data,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      orgId: this.orgId,
      entityType: entityConfig.name
    };
    await this.storage.transaction(async (txn) => {
      await txn.put(`record:${entityConfig.name}:${recordId}`, record);
      const entityStats = await txn.get(`stats:${entityConfig.name}`) || { recordCount: 0 };
      entityStats.recordCount++;
      entityStats.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await txn.put(`stats:${entityConfig.name}`, entityStats);
      const orgMetadata = await txn.get("org-metadata") || { totalRecords: 0 };
      orgMetadata.totalRecords++;
      orgMetadata.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await txn.put("org-metadata", orgMetadata);
    });
    console.log(`\u{1F4BE} Record saved in OrganizationDurableObject[${this.orgId}]: ${entityConfig.name}:${recordId}`);
    return { valid: true, errors: [], data: record };
  }
  /**
   * Query data with filters and pagination
   */
  async queryData(entityConfig, filters = {}) {
    const prefix = `record:${entityConfig.name}:`;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const allRecords = await this.storage.list({
      prefix,
      limit: limit + offset
    });
    const filteredRecords = Array.from(allRecords.values()).filter((record) => this.matchesFilters(record, filters)).slice(offset, offset + limit);
    return {
      valid: true,
      errors: [],
      data: {
        records: filteredRecords,
        total: filteredRecords.length,
        hasMore: allRecords.size === limit + offset,
        orgId: this.orgId,
        entityName: entityConfig.name
      }
    };
  }
  /**
   * Get records for an entity with pagination
   */
  async handleGetRecords(entityName, searchParams) {
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const prefix = `record:${entityName}:`;
    const records = await this.storage.list({ prefix, limit, offset });
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entityName,
      records: Array.from(records.values()),
      count: records.size,
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get organization and entity statistics
   */
  async handleGetStats() {
    const orgMetadata = await this.storage.get("org-metadata") || {};
    const storageList = await this.storage.list();
    const entityStats = {};
    for (const [key, value] of storageList.entries()) {
      if (key.startsWith("stats:")) {
        const entityName = key.replace("stats:", "");
        entityStats[entityName] = value;
      }
    }
    const stats = {
      objectId: this.orgId,
      orgId: this.orgId,
      recordCount: orgMetadata.totalRecords || 0,
      storageKeys: storageList.size,
      lastActivity: new Date(this.stats.lastRequestTime).toISOString(),
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: 0
      // Would need request timing to calculate
    };
    return new Response(JSON.stringify({
      success: true,
      stats,
      entityStats,
      metadata: orgMetadata,
      approach: "durable-objects",
      isolationLevel: this.config?.isolationLevel
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * List all entities in this organization
   */
  async handleListEntities() {
    const entityList = await this.storage.list({ prefix: "entity:" });
    const entities = Array.from(entityList.entries()).map(([key, config2]) => ({
      name: key.replace("entity:", ""),
      config: config2
    }));
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entities,
      count: entities.length,
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Broadcast message (placeholder for WebSocket support)
   */
  async handleBroadcast(message) {
    console.log(`\u{1F4E2} Broadcast in OrganizationDurableObject[${this.orgId}]:`, message);
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      message: "Broadcast sent (WebSocket support pending)",
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Spawn dedicated EntityDurableObject for entity-level isolation
   */
  async spawnEntityDurableObject(entityConfig) {
    try {
      const entityObjectId = `${this.orgId}:${entityConfig.name}`;
      const entityId = this.env.ENTITY_OBJECTS.idFromName(entityObjectId);
      const entityStub = this.env.ENTITY_OBJECTS.get(entityId);
      await entityStub.fetch("https://dummy-host/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entityConfig,
          parentOrgId: this.orgId
        })
      });
      console.log(`\u{1F680} Spawned EntityDurableObject: ${entityObjectId}`);
    } catch (error3) {
      console.error(`Failed to spawn EntityDurableObject:`, error3);
    }
  }
  /**
   * Helper method to check if record matches filters
   */
  matchesFilters(record, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === "limit" || key === "offset") continue;
      if (record[key] !== value) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculate requests per minute
   */
  calculateRequestsPerMinute() {
    const now = Date.now();
    const minuteAgo = now - 6e4;
    return this.stats.lastRequestTime > minuteAgo ? this.stats.requestCount : 0;
  }
};

// src/entity-durable-object.ts
import { DurableObject as DurableObject2 } from "cloudflare:workers";
var EntityDurableObject = class extends DurableObject2 {
  static {
    __name(this, "EntityDurableObject");
  }
  orgId;
  entityName;
  config;
  storage;
  rulesEngine;
  stats;
  constructor(env2, ctx) {
    super(env2, ctx);
    this.storage = ctx.storage;
    this.rulesEngine = new JsonRulesEngine();
    this.stats = {
      requestCount: 0,
      lastRequestTime: Date.now(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      recordCount: 0
    };
  }
  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request) {
    this.stats.requestCount++;
    this.stats.lastRequestTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/initialize" && request.method === "POST") {
        const config2 = await request.json();
        return this.handleInitialize(config2);
      }
      if (path === "/validate" && request.method === "POST") {
        const data = await request.json();
        return this.handleValidate(data);
      }
      if (path === "/save" && request.method === "POST") {
        const data = await request.json();
        return this.handleSave(data);
      }
      if (path === "/query" && request.method === "GET") {
        const searchParams = url.searchParams;
        return this.handleQuery(searchParams);
      }
      if (path === "/stats" && request.method === "GET") {
        return this.handleGetStats();
      }
      if (path === "/records" && request.method === "GET") {
        const searchParams = url.searchParams;
        return this.handleGetRecords(searchParams);
      }
      if (path === "/ws" && request.headers.get("Upgrade") === "websocket") {
        return this.handleWebSocket(request);
      }
      if (path === "/broadcast" && request.method === "POST") {
        const message = await request.json();
        return this.handleBroadcast(message);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error3) {
      console.error("EntityDurableObject error:", error3);
      return new Response(JSON.stringify({
        error: error3 instanceof Error ? error3.message : "Unknown error",
        objectId: `${this.orgId}:${this.entityName}`,
        isolationLevel: "entity-level"
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
  /**
   * Initialize the entity with configuration
   */
  async handleInitialize(config2) {
    this.orgId = config2.parentOrgId || config2.orgId;
    this.entityName = config2.name;
    this.config = config2;
    await this.storage.put("config", config2);
    await this.storage.put("metadata", {
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: 1,
      recordCount: 0,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
    await this.initializeIndexes();
    console.log(`\u{1F3AF} EntityDurableObject initialized: ${this.orgId}:${this.entityName}`);
    return new Response(JSON.stringify({
      success: true,
      objectId: `${this.orgId}:${this.entityName}`,
      orgId: this.orgId,
      entityName: this.entityName,
      isolationLevel: "entity-level",
      message: "Entity Durable Object initialized successfully"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Validate data against entity rules
   */
  async handleValidate(data) {
    const validation = await this.validateData(data);
    return new Response(JSON.stringify({
      success: validation.valid,
      ...validation,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: "entity-level",
      approach: "durable-objects"
    }), {
      status: validation.valid ? 200 : 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Save data with ultra-isolated persistent storage
   */
  async handleSave(data) {
    const validation = await this.validateData(data);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({
        success: false,
        ...validation,
        objectId: `${this.orgId}:${this.entityName}`,
        isolationLevel: "entity-level"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...validation.data,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      orgId: this.orgId,
      entityType: this.entityName
    };
    await this.storage.transaction(async (txn) => {
      await txn.put(`record:${recordId}`, record);
      const metadata = await txn.get("metadata") || { recordCount: 0 };
      metadata.recordCount++;
      metadata.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await txn.put("metadata", metadata);
      await this.updateCustomIndexes(txn, record);
    });
    this.stats.recordCount++;
    console.log(`\u{1F48E} Record saved in EntityDurableObject[${this.orgId}:${this.entityName}]: ${recordId}`);
    return new Response(JSON.stringify({
      success: true,
      data: record,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: "entity-level",
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Query data with advanced filtering and pagination
   */
  async handleQuery(searchParams) {
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filters = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "limit" && key !== "offset") {
        filters[key] = value;
      }
    }
    const allRecords = await this.storage.list({
      prefix: "record:",
      limit: limit + offset
    });
    const filteredRecords = Array.from(allRecords.values()).filter((record) => this.matchesFilters(record, filters)).slice(offset, offset + limit);
    return new Response(JSON.stringify({
      success: true,
      data: {
        records: filteredRecords,
        total: filteredRecords.length,
        hasMore: allRecords.size === limit + offset,
        filters
      },
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: "entity-level",
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get all records (for small datasets)
   */
  async handleGetRecords(searchParams) {
    const limit = parseInt(searchParams.get("limit") || "50");
    const records = await this.storage.list({ prefix: "record:", limit });
    return new Response(JSON.stringify({
      success: true,
      records: Array.from(records.values()),
      count: records.size,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: "entity-level",
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get detailed entity statistics
   */
  async handleGetStats() {
    const metadata = await this.storage.get("metadata") || {};
    const storageList = await this.storage.list();
    const stats = {
      objectId: `${this.orgId}:${this.entityName}`,
      orgId: this.orgId,
      entityName: this.entityName,
      recordCount: metadata.recordCount || 0,
      storageKeys: storageList.size,
      lastActivity: new Date(this.stats.lastRequestTime).toISOString(),
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: 0
      // Would track with request timing
    };
    return new Response(JSON.stringify({
      success: true,
      stats,
      metadata,
      config: this.config,
      isolationLevel: "entity-level",
      approach: "durable-objects"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Handle WebSocket connections for real-time updates
   */
  async handleWebSocket(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    return new Response(JSON.stringify({
      success: true,
      message: "WebSocket support pending implementation",
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: "entity-level"
    }), {
      status: 200,
      // Would be 101 for actual WebSocket upgrade
      headers: { "Content-Type": "application/json" }
    });
  }
  /**
   * Broadcast to connected WebSocket clients
   */
  async handleBroadcast(message) {
    console.log(`\u{1F4E1} Broadcast in EntityDurableObject[${this.orgId}:${this.entityName}]:`, message);
    return new Response(JSON.stringify({
      success: true,
      objectId: `${this.orgId}:${this.entityName}`,
      message: "Broadcast sent (WebSocket implementation pending)",
      isolationLevel: "entity-level"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Validate data using rules engine
   */
  async validateData(data) {
    if (!this.config) {
      return { valid: false, errors: ["Entity not properly initialized"] };
    }
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, this.config);
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, this.config);
    if (!typeValidation.valid) {
      return typeValidation;
    }
    if (this.config.validationRules && this.config.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, this.config.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }
    return { valid: true, errors: [], data: dataWithDefaults };
  }
  /**
   * Initialize custom indexes for efficient querying
   */
  async initializeIndexes() {
    if (!this.config.customFields) return;
    const indexes = [];
    for (const [fieldName, fieldConfig] of Object.entries(this.config.customFields)) {
      if (fieldConfig.indexed) {
        indexes.push(fieldName);
      }
    }
    if (indexes.length > 0) {
      await this.storage.put("indexes", indexes);
      console.log(`\u{1F4CA} Initialized indexes for EntityDurableObject[${this.orgId}:${this.entityName}]:`, indexes);
    }
  }
  /**
   * Update custom indexes when records are saved
   */
  async updateCustomIndexes(txn, record) {
    const indexes = await txn.get("indexes") || [];
    for (const indexField of indexes) {
      if (record[indexField] !== void 0) {
        const indexKey = `index:${indexField}:${record[indexField]}`;
        const currentRecords = await txn.get(indexKey) || [];
        currentRecords.push(record.id);
        await txn.put(indexKey, currentRecords);
      }
    }
  }
  /**
   * Helper method to check if record matches filters
   */
  matchesFilters(record, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (record[key] !== value) {
        return false;
      }
    }
    return true;
  }
  /**
   * Calculate requests per minute
   */
  calculateRequestsPerMinute() {
    const now = Date.now();
    const minuteAgo = now - 6e4;
    return this.stats.lastRequestTime > minuteAgo ? this.stats.requestCount : 0;
  }
};

// src/smart-routing-durable-object.ts
import { DurableObject as DurableObject3 } from "cloudflare:workers";
var SmartRoutingDurableObject = class extends DurableObject3 {
  static {
    __name(this, "SmartRoutingDurableObject");
  }
  storage;
  orgUsageStats = /* @__PURE__ */ new Map();
  entityUsageStats = /* @__PURE__ */ new Map();
  constructor(env2, ctx) {
    super(env2, ctx);
    this.storage = ctx.storage;
  }
  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/route" && request.method === "POST") {
        const routeRequest = await request.json();
        return this.handleRoute(routeRequest);
      }
      if (path === "/update-stats" && request.method === "POST") {
        const statsUpdate = await request.json();
        return this.handleUpdateStats(statsUpdate);
      }
      if (path === "/recommendations" && request.method === "GET") {
        return this.handleGetRecommendations();
      }
      if (path === "/analytics" && request.method === "GET") {
        return this.handleGetAnalytics();
      }
      if (path === "/auto-scale" && request.method === "POST") {
        const scaleRequest = await request.json();
        return this.handleAutoScale(scaleRequest);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error3) {
      console.error("SmartRoutingDurableObject error:", error3);
      return new Response(JSON.stringify({
        error: error3 instanceof Error ? error3.message : "Unknown error",
        service: "smart-routing"
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
  /**
   * Route request to optimal isolation level
   */
  async handleRoute(routeRequest) {
    const { orgId, entityName, operation, data, config: config2 } = routeRequest;
    const orgUsage = await this.getOrgUsageStats(orgId);
    const entityUsage = await this.getEntityUsageStats(orgId, entityName);
    const decision = await this.makeRoutingDecision(orgId, entityName, orgUsage, entityUsage, config2);
    const result = await this.executeRoute(decision, orgId, entityName, operation, data);
    return new Response(JSON.stringify({
      success: true,
      decision,
      result,
      approach: "smart-routing"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Make intelligent routing decision based on usage patterns
   */
  async makeRoutingDecision(orgId, entityName, orgUsage, entityUsage, config2) {
    if (config2?.isolationLevel && config2.isolationLevel !== "auto") {
      return {
        route: config2.isolationLevel,
        objectId: this.generateObjectId(config2.isolationLevel, orgId, entityName),
        reason: `Explicitly configured: ${config2.isolationLevel}`,
        confidence: 1
      };
    }
    let score = 0;
    let reasons = [];
    if (entityUsage.requestsPerMinute > 100) {
      score += 40;
      reasons.push(`High traffic: ${entityUsage.requestsPerMinute} req/min`);
    }
    if (this.parseSizeToMB(entityUsage.dataSize) > 10) {
      score += 30;
      reasons.push(`Large dataset: ${entityUsage.dataSize}`);
    }
    if (orgUsage.entitiesCount > 10 && entityUsage.requestsPerMinute < 50) {
      score -= 20;
      reasons.push(`Many entities (${orgUsage.entitiesCount}), moderate traffic`);
    }
    if (entityUsage.peakLoad > 200) {
      score += 25;
      reasons.push(`High peak load: ${entityUsage.peakLoad} req/min`);
    }
    if (entityUsage.requestsPerMinute < 5 && orgUsage.entitiesCount < 5) {
      score -= 30;
      reasons.push(`Low activity: ${entityUsage.requestsPerMinute} req/min`);
    }
    let route;
    let confidence;
    if (score >= 50) {
      route = "entity-level";
      confidence = Math.min(score / 100, 1);
    } else if (score >= 10) {
      route = "org-level";
      confidence = 0.7;
    } else {
      route = "shared";
      confidence = 0.6;
    }
    return {
      route,
      objectId: this.generateObjectId(route, orgId, entityName),
      reason: reasons.join("; "),
      confidence
    };
  }
  /**
   * Execute routing decision
   */
  async executeRoute(decision, orgId, entityName, operation, data) {
    const env2 = this.env;
    try {
      switch (decision.route) {
        case "entity-level":
          const entityId = env2.ENTITY_OBJECTS.idFromName(decision.objectId);
          const entityStub = env2.ENTITY_OBJECTS.get(entityId);
          const entityResponse = await entityStub.fetch(`https://dummy-host/${operation}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
          return await entityResponse.json();
        case "org-level":
          const orgId_obj = env2.ORG_OBJECTS.idFromName(orgId);
          const orgStub = env2.ORG_OBJECTS.get(orgId_obj);
          const orgResponse = await orgStub.fetch(`https://dummy-host/entity/${entityName}/${operation}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
          return await orgResponse.json();
        case "shared":
          return {
            success: true,
            message: "Handled in shared context",
            isolationLevel: "shared"
          };
        default:
          throw new Error(`Unknown routing decision: ${decision.route}`);
      }
    } catch (error3) {
      console.error(`Routing execution failed:`, error3);
      return {
        success: false,
        error: error3 instanceof Error ? error3.message : "Routing failed",
        decision
      };
    }
  }
  /**
   * Update usage statistics
   */
  async handleUpdateStats(statsUpdate) {
    const { orgId, entityName, stats } = statsUpdate;
    if (entityName) {
      const entityKey = `${orgId}:${entityName}`;
      const currentStats = this.entityUsageStats.get(entityKey) || this.getDefaultUsageStats();
      const updatedStats = { ...currentStats, ...stats, lastActivity: (/* @__PURE__ */ new Date()).toISOString() };
      this.entityUsageStats.set(entityKey, updatedStats);
      await this.storage.put(`entity-stats:${entityKey}`, updatedStats);
    }
    const currentOrgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
    const updatedOrgStats = { ...currentOrgStats, ...stats, lastActivity: (/* @__PURE__ */ new Date()).toISOString() };
    this.orgUsageStats.set(orgId, updatedOrgStats);
    await this.storage.put(`org-stats:${orgId}`, updatedOrgStats);
    return new Response(JSON.stringify({
      success: true,
      orgId,
      entityName,
      message: "Usage statistics updated",
      approach: "smart-routing"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get routing recommendations for all organizations
   */
  async handleGetRecommendations() {
    const recommendations = {};
    await this.loadStatsFromStorage();
    for (const [entityKey, entityStats] of this.entityUsageStats.entries()) {
      const [orgId, entityName] = entityKey.split(":");
      const orgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
      const decision = await this.makeRoutingDecision(orgId, entityName, orgStats, entityStats);
      recommendations[entityKey] = decision;
    }
    return new Response(JSON.stringify({
      success: true,
      recommendations,
      totalEntities: Object.keys(recommendations).length,
      approach: "smart-routing"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get usage analytics
   */
  async handleGetAnalytics() {
    await this.loadStatsFromStorage();
    const analytics = {
      totalOrganizations: this.orgUsageStats.size,
      totalEntities: this.entityUsageStats.size,
      highTrafficEntities: Array.from(this.entityUsageStats.entries()).filter(([_, stats]) => stats.requestsPerMinute > 50).length,
      orgStats: Object.fromEntries(this.orgUsageStats),
      entityStats: Object.fromEntries(this.entityUsageStats),
      recommendations: {
        entityLevel: 0,
        orgLevel: 0,
        shared: 0
      }
    };
    for (const [entityKey, entityStats] of this.entityUsageStats.entries()) {
      const [orgId, entityName] = entityKey.split(":");
      const orgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
      const decision = await this.makeRoutingDecision(orgId, entityName, orgStats, entityStats);
      analytics.recommendations[decision.route === "entity-level" ? "entityLevel" : decision.route === "org-level" ? "orgLevel" : "shared"]++;
    }
    return new Response(JSON.stringify({
      success: true,
      analytics,
      approach: "smart-routing"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Handle auto-scaling requests
   */
  async handleAutoScale(scaleRequest) {
    const { orgId, entityName, trigger, threshold } = scaleRequest;
    console.log(`\u{1F680} Auto-scale ${trigger} triggered for ${orgId}${entityName ? ":" + entityName : ""}`);
    return new Response(JSON.stringify({
      success: true,
      orgId,
      entityName,
      trigger,
      message: "Auto-scaling logic pending implementation",
      approach: "smart-routing"
    }), { headers: { "Content-Type": "application/json" } });
  }
  /**
   * Get organization usage statistics
   */
  async getOrgUsageStats(orgId) {
    if (!this.orgUsageStats.has(orgId)) {
      const stored = await this.storage.get(`org-stats:${orgId}`);
      if (stored) {
        this.orgUsageStats.set(orgId, stored);
        return stored;
      }
    }
    return this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
  }
  /**
   * Get entity usage statistics
   */
  async getEntityUsageStats(orgId, entityName) {
    const entityKey = `${orgId}:${entityName}`;
    if (!this.entityUsageStats.has(entityKey)) {
      const stored = await this.storage.get(`entity-stats:${entityKey}`);
      if (stored) {
        this.entityUsageStats.set(entityKey, stored);
        return stored;
      }
    }
    return this.entityUsageStats.get(entityKey) || this.getDefaultUsageStats();
  }
  /**
   * Load statistics from persistent storage
   */
  async loadStatsFromStorage() {
    const allStats = await this.storage.list();
    for (const [key, value] of allStats.entries()) {
      if (key.startsWith("org-stats:")) {
        const orgId = key.replace("org-stats:", "");
        this.orgUsageStats.set(orgId, value);
      } else if (key.startsWith("entity-stats:")) {
        const entityKey = key.replace("entity-stats:", "");
        this.entityUsageStats.set(entityKey, value);
      }
    }
  }
  /**
   * Generate object ID based on routing decision
   */
  generateObjectId(route, orgId, entityName) {
    switch (route) {
      case "entity-level":
        return `${orgId}:${entityName}`;
      case "org-level":
        return orgId;
      case "shared":
        return "shared-router";
      default:
        return `${orgId}:${entityName}`;
    }
  }
  /**
   * Parse data size string to megabytes
   */
  parseSizeToMB(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    switch (unit) {
      case "B":
        return value / (1024 * 1024);
      case "KB":
        return value / 1024;
      case "MB":
        return value;
      case "GB":
        return value * 1024;
      default:
        return 0;
    }
  }
  /**
   * Get default usage statistics
   */
  getDefaultUsageStats() {
    return {
      requestsPerMinute: 0,
      dataSize: "0MB",
      entitiesCount: 0,
      peakLoad: 0,
      lastActivity: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};

// src/index.ts
var app = new Hono2();
app.use("*", cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type"]
}));
app.get("/health", (c) => c.text("Function Factory POC OK"));
app.get("/primitives", (c) => {
  const primitives = getAllPrimitives();
  return c.json({ primitives, approach: "rules-based" });
});
app.get("/samples", (c) => {
  return c.json({
    samples: SAMPLE_CONFIGS,
    approach: "rules-based",
    note: "Sample entity configurations using declarative rules"
  });
});
app.post("/rules/deploy", async (c) => {
  try {
    const entityConfig = await c.req.json();
    const factory = new RulesFactory(c.env);
    const schema = await factory.deployEntity(entityConfig);
    return c.json({
      success: true,
      message: "Entity configuration deployed successfully",
      schema,
      approach: "rules-based"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 400);
  }
});
app.post("/factory/deploy", async (c) => {
  try {
    const entityDef = await c.req.json();
    const factory = new RulesFactory(c.env);
    const entityConfig = entityDef;
    const schema = await factory.deployEntity(entityConfig);
    return c.json({
      success: true,
      message: "Entity deployed successfully (using rules-based approach)",
      schema,
      approach: "rules-based",
      note: "Dynamic function execution replaced with secure rule-based validation"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 400);
  }
});
app.post("/entity/:orgId/:entityName/:operation", async (c) => {
  try {
    const { orgId, entityName, operation } = c.req.param();
    const data = await c.req.json();
    const factory = new RulesFactory(c.env);
    let result;
    switch (operation) {
      case "validate":
        result = await factory.executeValidation(orgId, entityName, data);
        break;
      case "save":
        result = await factory.executeSave(orgId, entityName, data);
        break;
      case "query":
        result = await factory.executeQuery(orgId, entityName, data);
        break;
      default:
        return c.json({
          success: false,
          error: `Unknown operation: ${operation}. Supported: validate, save, query`
        }, 400);
    }
    if (!result.valid) {
      return c.json({
        success: false,
        errors: result.errors,
        approach: "rules-based"
      }, 400);
    }
    return c.json({
      success: true,
      result: result.data,
      approach: "rules-based"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/schema/:orgId/:entityName", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const factory = new RulesFactory(c.env);
    const schema = await factory.getEntitySchema(orgId, entityName);
    if (!schema) {
      return c.json({ error: "Schema not found" }, 404);
    }
    return c.json({ schema, approach: "rules-based" });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/org/:orgId/entities", async (c) => {
  try {
    const { orgId } = c.req.param();
    const factory = new RulesFactory(c.env);
    const entities = await factory.listOrgEntities(orgId);
    return c.json({ entities, approach: "rules-based" });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/debug/configurations", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const debug3 = await factory.debugConfigurations();
    return c.json({
      ...debug3,
      approach: "rules-based",
      note: "Configurations stored instead of executable functions"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/debug/functions", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const debug3 = await factory.debugConfigurations();
    return c.json({
      functions: [],
      // No longer storing executable functions
      schemas: debug3.schemas,
      config: debug3.configurations,
      approach: "rules-based",
      note: "Function execution replaced with secure rule-based validation"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/debug/config/:key", async (c) => {
  try {
    const { key } = c.req.param();
    const factory = new RulesFactory(c.env);
    const config2 = await factory.getConfiguration(key);
    if (!config2.config && !config2.schema) {
      return c.json({ error: "Configuration not found" }, 404);
    }
    return c.json({ ...config2, approach: "rules-based" });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/reports/database", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report2 = await factory.getDatabaseReport();
    return c.json({
      ...report2,
      approach: "rules-based",
      reportType: "database-schema",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/reports/types", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report2 = factory.getTypeGenerationReport();
    return c.json({
      ...report2,
      approach: "rules-based",
      reportType: "typescript-generation"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/reports/multi-org", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const report2 = await factory.getMultiOrgReport();
    return c.json({
      ...report2,
      approach: "rules-based",
      reportType: "multi-org-comprehensive",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.post("/entity/:orgId/:entityName/fields", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const fieldData = await c.req.json();
    const factory = new RulesFactory(c.env);
    const result = await factory.addCustomField(
      orgId,
      entityName,
      fieldData.fieldName,
      fieldData.fieldConfig
    );
    return c.json({
      success: true,
      message: "Custom field added successfully",
      migration: result.migration,
      generatedTypes: result.generatedTypes,
      approach: "rules-based"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.post("/data/:orgId/:entityName/save", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const data = await c.req.json();
    const factory = new RulesFactory(c.env);
    const validation = await factory.executeValidation(orgId, entityName, data);
    if (!validation.valid || !validation.data) {
      return c.json({
        success: false,
        errors: validation.errors,
        approach: "rules-based",
        persistenceType: "d1-sqlite"
      }, 400);
    }
    const convertedData = {};
    Object.entries(validation.data).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (typeof value === "boolean") {
        convertedData[snakeKey] = value ? 1 : 0;
      } else if (Array.isArray(value)) {
        convertedData[snakeKey] = JSON.stringify(value);
      } else {
        convertedData[snakeKey] = value;
      }
    });
    const saveData = {
      id: crypto.randomUUID(),
      ...convertedData,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      organization_id: orgId,
      custom_data: JSON.stringify({})
    };
    const tableName = `${orgId.replace(/-/g, "_")}_${entityName.toLowerCase()}s`;
    const result = await factory["databaseManager"].insertRecord(tableName, saveData);
    return c.json({
      success: true,
      data: result,
      approach: "rules-based",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error",
      persistenceType: "d1-sqlite"
    }, 500);
  }
});
app.get("/data/:orgId/:entityName", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const limit = parseInt(c.req.query("limit") || "10");
    const factory = new RulesFactory(c.env);
    const tableName = `${orgId.replace(/-/g, "_")}_${entityName.toLowerCase()}s`;
    const records = await factory["databaseManager"].queryRecords(
      tableName,
      { organization_id: orgId },
      limit
    );
    return c.json({
      success: true,
      data: records,
      count: records.length,
      approach: "rules-based",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error",
      persistenceType: "d1-sqlite"
    }, 500);
  }
});
app.get("/debug/table/:tableName/schema", async (c) => {
  try {
    const { tableName } = c.req.param();
    const factory = new RulesFactory(c.env);
    const tableInfo = await factory["databaseManager"].getTableInfo(tableName);
    return c.json({
      tableName,
      schema: tableInfo,
      approach: "rules-based",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error",
      persistenceType: "d1-sqlite"
    }, 500);
  }
});
app.get("/debug/migrations", async (c) => {
  try {
    const factory = new RulesFactory(c.env);
    const migrations = await factory["databaseManager"].getStoredMigrations();
    return c.json({
      migrations: migrations.slice(0, 20),
      // Latest 20
      total: migrations.length,
      approach: "rules-based",
      persistenceType: "d1-sqlite"
    });
  } catch (error3) {
    return c.json({
      error: error3 instanceof Error ? error3.message : "Unknown error",
      persistenceType: "d1-sqlite"
    }, 500);
  }
});
app.post("/durable/org/:orgId/init", async (c) => {
  try {
    const { orgId } = c.req.param();
    const config2 = await c.req.json();
    const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
    const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
    const response = await orgStub.fetch("https://dummy-host/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config2, orgId })
    });
    const result = await response.json();
    return c.json({
      success: true,
      ...result,
      approach: "durable-objects"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.post("/durable/deploy", async (c) => {
  try {
    const entityConfig = await c.req.json();
    const orgId = entityConfig.orgId;
    const routerId = c.env.ROUTER_OBJECTS.idFromName("main-router");
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    const routeResponse = await routerStub.fetch("https://dummy-host/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        entityName: entityConfig.name,
        operation: "deploy",
        data: entityConfig
      })
    });
    const routeResult = await routeResponse.json();
    if (routeResult.decision?.route === "org-level") {
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      await orgStub.fetch("https://dummy-host/deploy-entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entityConfig)
      });
    }
    return c.json({
      success: true,
      entityConfig,
      routing: routeResult,
      approach: "durable-objects"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.post("/durable/entity/:orgId/:entityName/:operation", async (c) => {
  try {
    const { orgId, entityName, operation } = c.req.param();
    const data = await c.req.json();
    const routerId = c.env.ROUTER_OBJECTS.idFromName("main-router");
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    const response = await routerStub.fetch("https://dummy-host/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        entityName,
        operation,
        data
      })
    });
    const result = await response.json();
    return c.json({
      ...result,
      approach: "durable-objects",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/durable/org/:orgId/stats", async (c) => {
  try {
    const { orgId } = c.req.param();
    const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
    const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
    const response = await orgStub.fetch("https://dummy-host/stats");
    const result = await response.json();
    return c.json({
      ...result,
      approach: "durable-objects"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/durable/entity/:orgId/:entityName/stats", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
    const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
    const response = await entityStub.fetch("https://dummy-host/stats");
    const result = await response.json();
    return c.json({
      ...result,
      approach: "durable-objects"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/durable/routing/analytics", async (c) => {
  try {
    const routerId = c.env.ROUTER_OBJECTS.idFromName("main-router");
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    const response = await routerStub.fetch("https://dummy-host/analytics");
    const result = await response.json();
    return c.json({
      ...result,
      approach: "smart-routing"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/durable/routing/recommendations", async (c) => {
  try {
    const routerId = c.env.ROUTER_OBJECTS.idFromName("main-router");
    const routerStub = c.env.ROUTER_OBJECTS.get(routerId);
    const response = await routerStub.fetch("https://dummy-host/recommendations");
    const result = await response.json();
    return c.json({
      ...result,
      approach: "smart-routing"
    });
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.post("/durable/data/:orgId/:entityName/save", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const data = await c.req.json();
    try {
      const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
      const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
      const response = await entityStub.fetch("https://dummy-host/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: "entity-level",
        approach: "durable-objects"
      });
    } catch {
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      const response = await orgStub.fetch(`https://dummy-host/entity/${entityName}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: "org-level",
        approach: "durable-objects"
      });
    }
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
app.get("/durable/data/:orgId/:entityName", async (c) => {
  try {
    const { orgId, entityName } = c.req.param();
    const limit = c.req.query("limit") || "20";
    try {
      const entityObjectId = c.env.ENTITY_OBJECTS.idFromName(`${orgId}:${entityName}`);
      const entityStub = c.env.ENTITY_OBJECTS.get(entityObjectId);
      const response = await entityStub.fetch(`https://dummy-host/records?limit=${limit}`);
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: "entity-level",
        approach: "durable-objects"
      });
    } catch {
      const orgObjectId = c.env.ORG_OBJECTS.idFromName(orgId);
      const orgStub = c.env.ORG_OBJECTS.get(orgObjectId);
      const response = await orgStub.fetch(`https://dummy-host/entity/${entityName}/records?limit=${limit}`);
      const result = await response.json();
      return c.json({
        ...result,
        isolationLevel: "org-level",
        approach: "durable-objects"
      });
    }
  } catch (error3) {
    return c.json({
      success: false,
      error: error3 instanceof Error ? error3.message : "Unknown error"
    }, 500);
  }
});
var src_default = app;

// ../../node_modules/.pnpm/wrangler@4.28.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.28.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-8fYV5O/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@4.28.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-8fYV5O/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  EntityDurableObject,
  OrganizationDurableObject,
  SmartRoutingDurableObject,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
