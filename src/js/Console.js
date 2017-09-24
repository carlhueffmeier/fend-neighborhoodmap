const DEBUG = false;

export default function Console() {
  if (DEBUG) {
    console.log(...arguments);
  }
}
