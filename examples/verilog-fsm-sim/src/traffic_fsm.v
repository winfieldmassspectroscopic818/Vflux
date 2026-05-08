// Small traffic-light style FSM for simulation.

module traffic_fsm (
  input  wire clk,
  input  wire rst_n,
  input  wire sensor,
  output reg  red,
  output reg  yellow,
  output reg  green
);
  localparam STATE_RED    = 2'd0;
  localparam STATE_GREEN  = 2'd1;
  localparam STATE_YELLOW = 2'd2;

  reg [1:0] state = STATE_RED;
  reg [3:0] timer = 4'd0;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      state <= STATE_RED;
      timer <= 4'd0;
    end else begin
      timer <= timer + 4'd1;
      case (state)
        STATE_RED: begin
          if (timer == 4'd4 && sensor) begin
            state <= STATE_GREEN;
            timer <= 4'd0;
          end
        end
        STATE_GREEN: begin
          if (timer == 4'd8) begin
            state <= STATE_YELLOW;
            timer <= 4'd0;
          end
        end
        STATE_YELLOW: begin
          if (timer == 4'd2) begin
            state <= STATE_RED;
            timer <= 4'd0;
          end
        end
        default: begin
          state <= STATE_RED;
          timer <= 4'd0;
        end
      endcase
    end
  end

  always @* begin
    red = state == STATE_RED;
    green = state == STATE_GREEN;
    yellow = state == STATE_YELLOW;
  end
endmodule
