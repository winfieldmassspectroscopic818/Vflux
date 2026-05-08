// UART echo example for iCESugar.

module top (
  input  wire clk,
  input  wire uart_rx,
  output wire uart_tx,
  output reg  led1 = 1'b0,
  output wire led2,
  output wire led3
);
  localparam CLKS_PER_BIT = 104; // 12 MHz / 115200 baud, rounded.

  wire [7:0] rx_data;
  wire rx_valid;
  wire tx_busy;
  reg tx_start = 1'b0;
  reg [7:0] tx_data = 8'd0;
  reg [23:0] heartbeat = 24'd0;

  uart_rx #(.CLKS_PER_BIT(CLKS_PER_BIT)) rx_inst (
    .clk(clk),
    .rx(uart_rx),
    .data(rx_data),
    .valid(rx_valid)
  );

  uart_tx #(.CLKS_PER_BIT(CLKS_PER_BIT)) tx_inst (
    .clk(clk),
    .start(tx_start),
    .data(tx_data),
    .tx(uart_tx),
    .busy(tx_busy)
  );

  always @(posedge clk) begin
    heartbeat <= heartbeat + 24'd1;
    tx_start <= 1'b0;

    if (rx_valid && !tx_busy) begin
      tx_data <= rx_data;
      tx_start <= 1'b1;
      led1 <= ~led1;
    end
  end

  assign led2 = tx_busy;
  assign led3 = heartbeat[23];
endmodule
