<%@ page language="C#" autoeventwireup="true" inherits="RTLogView, App_Web_lofxcc4m" enableEventValidation="false" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>Untitled Page</title>
</head>
<body>
    <form id="form1" runat="server">
     <asp:ScriptManager ID="ScriptManager1" runat="server"></asp:ScriptManager>
         <asp:UpdatePanel ID="UpdatePanel2" runat="server" UpdateMode="Always">
        <ContentTemplate>
    <div>
    
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0; height: 49px; margin-bottom: 17px;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label></div>
    
    </div>
        <asp:Panel ID="Panel1" runat="server" BackColor="#CCCCCC" Font-Size="Large" 
            Height="28px">
            &nbsp;&nbsp;&nbsp;&nbsp; Real-time Attend Log View&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:LinkButton ID="goback" runat="server" onclick="goback_Click">Go Home</asp:LinkButton>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>

        
        <asp:Panel ID="Panel2" runat="server" style="margin-top: 13px">
        <table><tr valign="top"><td>
            <asp:GridView ID="gvLog" runat="server" AutoGenerateColumns="False" 
            Width="893px"
            onsorting="gvLog_Sorting"
            onpageindexchanging="gvLog_PageIndexChanging"
            onselectedindexchanged="gvLog_SelectedIndexChanged"
            >
                <RowStyle BackColor="#F7F6F3" ForeColor="#333333" />
                <FooterStyle BackColor="#5D7B9D" Font-Bold="True" ForeColor="White" />
                <PagerStyle BackColor="#284775" ForeColor="White" HorizontalAlign="Center" />
                <SelectedRowStyle BackColor="#E2DED6" Font-Bold="True" ForeColor="#333333" />
                <HeaderStyle BackColor="#5D7B9D" Font-Bold="True" ForeColor="White" />
                <EditRowStyle BackColor="#999999" />
                <AlternatingRowStyle BackColor="White" ForeColor="#284775" />
                <Columns>
                    <asp:BoundField DataField="id" HeaderText="ID" ReadOnly="True"  
            SortExpression="id" />
                    <asp:BoundField DataField="dev_id" HeaderText="Device ID" ReadOnly="True"  
            SortExpression="device_id" />
                    <asp:BoundField DataField="user_id" HeaderText="User ID" ReadOnly="True"  
            SortExpression="user_id" />
                    <asp:BoundField DataField="verify_mode" HeaderText="Verify Mode" ReadOnly="True"  
            SortExpression="verify_mode" />
                    <asp:BoundField DataField="io_mode" HeaderText="IO Mode" ReadOnly="True"  
            SortExpression="io_mode" />
                    <asp:BoundField DataField="io_time" HeaderText="IO Time" ReadOnly="True"  
            SortExpression="io_time" />
                    <asp:BoundField DataField="temperature" HeaderText="Temperature" ReadOnly="True"  
            SortExpression="temperature" />
                    <asp:BoundField DataField="log_image" HeaderText="Log Image" ReadOnly="True"  
            />

                </Columns>
            </asp:GridView>
            </td><td>
                        <asp:Image ID="LogImage" runat="server" Height="188px" Width="154px" 
                BorderColor="#666666" BorderWidth="2px" EnableTheming="False" 
                EnableViewState="False" />

            </td></tr></table>
        </asp:Panel>
            <asp:Panel ID="Panel5" runat="server" BorderStyle="Groove" Height="44px" 
                style="margin-top: 29px" BackColor="#EEEEEE">
                &nbsp;
                <asp:Label ID="Label9" runat="server" Font-Size="Large" Text="Status"></asp:Label>
                <br />
                &nbsp; &nbsp;&nbsp;&nbsp;
                <asp:Label ID="StatusTxt" runat="server"></asp:Label>
            </asp:Panel>

            <asp:timer ID="Timer" runat="server" Interval="1000" OnTick="Timer_Watch" 
                    Enabled="true"></asp:timer>
        </ContentTemplate>
        </asp:UpdatePanel>
    </form>
</body>
</html>
