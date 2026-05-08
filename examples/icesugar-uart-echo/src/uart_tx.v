// Minimal 8N1 UART transmitter.

module uart_tx #(
  parameter CLKS_PER_BIT = 104
) (
  input  wire      clk,
  input  wire      start,
  input  wire [7:0] data,
  output reg       tx = 1'b1,
  output wire      busy
);
  localparam STATE_IDLE  = 2'd0;
  localparam STATE_START = 2'd1;
  localparam STATE_DATA  = 2'd2;
  localparam STATE_STOP  = 2'd3;

  reg [1:0] state = STATE_IDLE;
  reg [15:0] clk_count = 16'd0;
  reg [2:0] bit_index = 3'd0;
  reg [7:0] shift = 8'd0;

  assign busy = state != STATE_IDLE;

  always @(posedge clk) begin
    case (state)
      STATE_IDLE: begin
        tx <= 1'b1;
        clk_count <= 16'd0;
        bit_index <= 3'd0;
        if (start) begin
          shift <= data;
          state <= STATE_START;
        end
      end
      STATE_START: begin
        tx <= 1'b0;
        if (clk_count == CLKS_PER_BIT - 1) begin
          clk_count <= 16'd0;
          state <= STATE_DATA;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      STATE_DATA: begin
        tx <= shift[bit_index];
        if (clk_count == CLKS_PER_BIT - 1) begin
          clk_count <= 16'd0;
          if (bit_index == 3'd7) state <= STATE_STOP;
          else bit_index <= bit_index + 3'd1;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      STATE_STOP: begin
        tx <= 1'b1;
        if (clk_count == CLKS_PER_BIT - 1) begin
          clk_count <= 16'd0;
          state <= STATE_IDLE;
        end else begin
          clk_count <= clk_count + 16'd1;
        end
      end
      default: state <= STATE_IDLE;
    endcase
  end
endmodule
