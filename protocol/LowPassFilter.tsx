import { useState, useRef, useEffect } from "react";

/**
 * LowPassFilter - A component that limits callback execution rate
 *
 * @param {Object} props
 * @param {any} props.value - The input value to monitor for changes
 * @param {Function} props.onOutput - Callback executed at maximum frequency specified
 * @param {number} [props.initialFrequency=10] - Initial output frequency in Hz
 * @param {number} [props.minFrequency=1] - Minimum output frequency in Hz
 * @param {number} [props.maxFrequency=60] - Maximum output frequency in Hz
 */
export const LowPassFilter = ({
  value,
  onOutput,
  initialFrequency = 10,
  minFrequency = 1,
  maxFrequency = 60,
}) => {
  const [outputFrequency, setOutputFrequency] = useState(initialFrequency);
  const [inputFrequency, setInputFrequency] = useState(0);

  const lastValueRef = useRef(value);
  const lastOutputTimeRef = useRef(0);
  const lastInputTimeRef = useRef(Date.now());
  const changeCountRef = useRef(0);
  const frequencyUpdateTimerRef = useRef(null);
  const outputTimerRef = useRef(null);
  const valueQueueRef = useRef([]);

  // Handle new input values
  useEffect(() => {
    // Skip initial render
    if (lastValueRef.current === value) return;

    const now = Date.now();
    changeCountRef.current++;

    // Track value for change detection
    lastValueRef.current = value;

    // Add to queue for potential output
    valueQueueRef.current.push(value);

    // Schedule output if needed
    scheduleNextOutput();

    // Using a ref to track last input time to calculate frequency
    lastInputTimeRef.current = now;
  }, [value]);

  // Calculate input frequency
  useEffect(() => {
    // Set up a timer to calculate input frequency
    const calculateFrequency = () => {
      const now = Date.now();
      const elapsedSeconds = (now - lastInputTimeRef.current) / 1000;

      // If we have changes and some time has elapsed since last change
      if (changeCountRef.current > 0 && elapsedSeconds > 0) {
        // Calculate frequency as changes per second
        setInputFrequency(Math.round(changeCountRef.current / elapsedSeconds));

        // Reset counter
        changeCountRef.current = 0;
        lastInputTimeRef.current = now;
      } else if (elapsedSeconds > 1 && changeCountRef.current === 0) {
        // If more than a second has passed with no changes, show 0 Hz
        setInputFrequency(0);
      }
    };

    // Update frequency calculation approximately every second
    frequencyUpdateTimerRef.current = setInterval(calculateFrequency, 1000);

    return () => {
      clearInterval(frequencyUpdateTimerRef.current);
    };
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (outputTimerRef.current) {
        clearTimeout(outputTimerRef.current);
      }
      if (frequencyUpdateTimerRef.current) {
        clearInterval(frequencyUpdateTimerRef.current);
      }
    };
  }, []);

  // Schedule next output based on frequency
  const scheduleNextOutput = () => {
    // If there's nothing to output, don't schedule
    if (valueQueueRef.current.length === 0) return;

    // If there's already a scheduled output, don't schedule another
    if (outputTimerRef.current) return;

    const now = Date.now();
    const timeSinceLastOutput = now - lastOutputTimeRef.current;
    const minTimeBetweenOutputs = 1000 / outputFrequency; // ms between outputs

    // Calculate delay until next allowed output
    let delay = Math.max(0, minTimeBetweenOutputs - timeSinceLastOutput);

    outputTimerRef.current = setTimeout(() => {
      // If there are values to output
      if (valueQueueRef.current.length > 0) {
        // Get the latest value (most recent change)
        const latestValue =
          valueQueueRef.current[valueQueueRef.current.length - 1];

        // Clear the queue
        valueQueueRef.current = [];

        // Send the value
        onOutput(latestValue);

        // Record the time of this output
        lastOutputTimeRef.current = Date.now();
      }

      // Clear the timer reference
      outputTimerRef.current = null;

      // Check if we need to schedule more outputs
      if (valueQueueRef.current.length > 0) {
        scheduleNextOutput();
      }
    }, delay);
  };

  // Update the output frequency
  const handleFrequencyChange = (event) => {
    setOutputFrequency(Number(event.target.value));
  };

  return (
    <div className="low-pass-filter">
      <div className="frequency-display">
        <div>Input Frequency: {inputFrequency} Hz</div>
        <div>Output Frequency: {outputFrequency} Hz</div>
      </div>

      <div className="frequency-control">
        <label htmlFor="frequency-slider">Output Frequency: </label>
        <input
          id="frequency-slider"
          type="range"
          min={minFrequency}
          max={maxFrequency}
          value={outputFrequency}
          onChange={handleFrequencyChange}
        />
      </div>
    </div>
  );
};

export default LowPassFilter;
