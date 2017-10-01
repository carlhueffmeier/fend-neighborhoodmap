const DEBUG = true;

export default function Console() {
  if (DEBUG) {
    console.log(...arguments);
  }
}
