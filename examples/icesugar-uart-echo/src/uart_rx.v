// Minimal 8N1 UART receiver.

module uart_rx #(
  parameter CLKS_PER_BIT = 104
) (
  input  wire       clk,
  input  wire       rx,
  output reg [7:0]  data = 8'd0,
  output reg        valid = 1'b0
);
  localparam STATE_IDLE  = 2'd0;
  localparam STATE_START = 2'd1;
  localparam STATE_DATA  = 2'd2;
  localparam STATE_STOP  = 2'd3;

  reg [1:0] state = STATE_IDLE;
  reg [15:0] clk_count = 16'd0;
  reg [2:0] bit_index = 3'd0;
  reg rx_sync_0 = 1'b1;
  reg rx_sync_1 = 1'b1;

  always @(posedge clk) begin
    rx_sync_0 <= rx;
    rx_sync_1 <= rx_sync_0;
    valid <= 1'b0;

    case (state)
      STATE_IDLE: begin
        clk_count <= 16'd0;
        bit_index <= 3'd0;
        if (!rx_sync_1) state <= STATE_START;
      end
      STATE_START: begin
        if (clk_count == (CLKS_PER_BIT / 2)) begin
          clk_count <= 16'd0;
          state <= rx_sync_1 ? STATE_IDLE : STATE_DATA;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      STATE_DATA: begin
        if (clk_count == CLKS_PER_BIT - 1) begin
          clk_count <= 16'd0;
          data[bit_index] <= rx_sync_1;
          if (bit_index == 3'd7) state <= STATE_STOP;
          else bit_index <= bit_index + 3'd1;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      STATE_STOP: begin
        if (clk_count == CLKS_PER_BIT - 1) begin
          clk_count <= 16'd0;
          valid <= 1'b1;
          state <= STATE_IDLE;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      default: state <= STATE_IDLE;
    endcase
  end
endmodule
