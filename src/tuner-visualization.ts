export default class TunerVisualization {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private containerElement: HTMLElement;

  private pitchColors: string[] = [
    'red', 'orange', 'yellow', 'green', 'blue', 'purple',
  ];

  constructor(containerId: string) {
    // Find the card body within the tuner container
    const tunerContainer = document.getElementById(containerId);
    if (!tunerContainer) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }

    this.containerElement = tunerContainer.querySelector('.card-body') as HTMLElement;
    if (!this.containerElement) {
      throw new Error(`Card body not found in container '${containerId}'`);
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = 600;
    this.canvas.height = 200;
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';

    this.ctx = this.canvas.getContext('2d')!;
    if (!this.ctx) {
      throw new Error('Could not get canvas context');
    }
  }

  drawTunerGraph(timeData: number[], centsData: number[], noteData: string[]): void {
    // Ensure canvas is in the DOM
    this.containerElement.innerHTML = '';
    this.containerElement.appendChild(this.canvas);

    if (timeData.length === 0 || centsData.length === 0) {
      //this.drawEmptyMessage();
      return;
    }

    const { width, height } = this.canvas;
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    // Clear canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);

    // Find data ranges
    const maxTime = Math.max(...timeData);
    const minTime = Math.min(...timeData);
    const maxCents = Math.max(50, Math.max(...centsData)); // At least ±50 cents range
    const minCents = Math.min(-50, Math.min(...centsData));

    // Draw grid and axes
    this.drawGrid(padding, graphWidth, graphHeight, minCents, maxCents);
    this.drawAxes(padding, graphWidth, graphHeight, minTime, maxTime, minCents, maxCents);

    // Draw the pitch deviation line
    this.drawPitchLine(timeData, centsData, noteData, padding, graphWidth, graphHeight, minTime, maxTime, minCents, maxCents);

    // Draw zero line (perfect pitch)
    this.drawZeroLine(padding, graphWidth, graphHeight, minCents, maxCents);
  }

  private drawGrid(padding: number, graphWidth: number, graphHeight: number, minCents: number, maxCents: number): void {
    this.ctx.strokeStyle = '#f0f0f0';
    this.ctx.lineWidth = 1;

    // Horizontal grid lines for cents (every 25 cents)
    const centsRange = maxCents - minCents;
    const centsStep = 25;
    for (let cents = Math.ceil(minCents / centsStep) * centsStep; cents <= maxCents; cents += centsStep) {
      const y = padding + graphHeight - ((cents - minCents) / centsRange) * graphHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(padding + graphWidth, y);
      this.ctx.stroke();
    }

    // Vertical grid lines (every 10% of time)
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * graphWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, padding + graphHeight);
      this.ctx.stroke();
    }
  }

  private drawAxes(padding: number, graphWidth: number, graphHeight: number,
                  minTime: number, maxTime: number, minCents: number, maxCents: number): void {
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#333333';

    // Y-axis labels (cents)
    const centsRange = maxCents - minCents;
    const centsStep = 25;
    for (let cents = Math.ceil(minCents / centsStep) * centsStep; cents <= maxCents; cents += centsStep) {
      const y = padding + graphHeight - ((cents - minCents) / centsRange) * graphHeight;
      this.ctx.fillText(cents.toString(), 5, y + 4);
    }

    // X-axis labels (time in seconds)
    const timeRange = maxTime - minTime;
    for (let i = 0; i <= 5; i++) {
      const time = minTime + (i / 5) * timeRange;
      const x = padding + (i / 5) * graphWidth;
      this.ctx.fillText(`${time.toFixed(1)}s`, x - 15, padding + graphHeight + 15);
    }

    // Labels
    this.ctx.save();
    this.ctx.translate(15, padding + graphHeight / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.restore();
  }

  private drawPitchLine(
    timeData: number[],
    centsData: number[],
    noteData: string[],
    padding: number,
    graphWidth: number,
    graphHeight: number,
    minTime: number,
    maxTime: number,
    minCents: number,
    maxCents: number,
  ): void {
    if (timeData.length === 0) {
      return;
    }

    this.ctx.strokeStyle = this.nextPitchColor();
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    const timeRange = maxTime - minTime;
    const centsRange = maxCents - minCents;

    let prevNote = "";
    for (let i = 0; i < timeData.length; i++) {
      const x = padding + ((timeData[i] - minTime) / timeRange) * graphWidth;
      const y = padding + graphHeight - ((centsData[i] - minCents) / centsRange) * graphHeight;
      const note = noteData[i];

      if (note !== prevNote) {
        this.ctx.stroke();
        this.ctx.strokeStyle = this.nextPitchColor();
        this.ctx.moveTo(x, y);
        this.ctx.beginPath();
      } else {
        this.ctx.lineTo(x, y);
      }
      prevNote = note;
    }

    this.ctx.stroke();
  }

  private nextPitchColor(): string {
    const color = this.pitchColors.shift() || '';
    this.pitchColors.push(color);
    return color;
  }

  private drawZeroLine(padding: number, graphWidth: number, graphHeight: number,
                      minCents: number, maxCents: number): void {
    const centsRange = maxCents - minCents;
    const y = padding + graphHeight - ((0 - minCents) / centsRange) * graphHeight;

    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 15]);

    this.ctx.beginPath();
    this.ctx.moveTo(padding, y);
    this.ctx.lineTo(padding + graphWidth, y);
    this.ctx.stroke();

    this.ctx.setLineDash([]); // Reset line dash
  }

  private drawEmptyMessage(): void {
    const { width, height } = this.canvas;

    // Clear canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);

    // Draw border
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, width, height);

    // Draw message
    this.ctx.fillStyle = '#666666';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'center';
    //this.ctx.fillText('Record and stop to see tuner analysis', width / 2, height / 2);
    this.ctx.textAlign = 'left'; // Reset text alignment
  }

  show(): void {
    // Make sure the parent collapse element is shown
    const tunerCollapse = this.containerElement.closest('.collapse') as HTMLElement;
    if (tunerCollapse) {
      tunerCollapse.style.display = 'block';
    }
  }

  hide(): void {
    // Hide by removing canvas and showing default message
    this.containerElement.innerHTML = '';
  }

  clear(): void {
    // Show empty state with canvas ready
    this.containerElement.innerHTML = '';
    this.containerElement.appendChild(this.canvas);
    //this.drawEmptyMessage();
  }
}
