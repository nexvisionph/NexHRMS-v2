<%@ Page Language="C#" AutoEventWireup="true" CodeFile="LogManager.aspx.cs" Inherits="LogManager" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title></title>
</head>
<body>
    <form id="form1" runat="server">
    <div>
    
    <div style="border: thin hidden #00FF00; font-size: xx-large; background-color: #C0C0D0; height: 49px; margin-bottom: 17px;">
    
    &nbsp;&nbsp; FKAttend BS Sample <asp:Label ID="Version" runat="server"></asp:Label></div>
    
    </div>
      <asp:ScriptManager ID="ScriptManager1" runat="server"></asp:ScriptManager>
         <asp:UpdatePanel ID="UpdatePanel2" runat="server" UpdateMode="Always">
        <ContentTemplate>
        <asp:Panel ID="Panel1" runat="server" BackColor="#CCCCCC" Font-Size="Large" 
            Height="28px">
            &nbsp;&nbsp;&nbsp;&nbsp; Log Manage&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:Label ID="Label1" runat="server" Text="Device ID :"></asp:Label>
            &nbsp;&nbsp;
            <asp:Label ID="DevID" runat="server"></asp:Label>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <asp:Label ID="Label10" runat="server" Text="Date:"></asp:Label>
            &nbsp;<asp:TextBox ID="BeginDate" runat="server"></asp:TextBox>
            &nbsp;
            <asp:Label ID="Label11" runat="server" Text="-"></asp:Label>
            &nbsp;&nbsp;<asp:TextBox ID="EndDate" runat="server"></asp:TextBox>
            &nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            
            
            <asp:LinkButton ID="goback" runat="server" onclick="goback_Click">Go Home</asp:LinkButton>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </asp:Panel>

        
            <asp:GridView ID="gvLog" runat="server" AutoGenerateColumns="False" 
            Width="893px"
            onpageindexchanging="gvLog_PageIndexChanging" style="margin-bottom: 14px"
            >
                <RowStyle BackColor="#F7F6F3" ForeColor="#333333" />
                <FooterStyle BackColor="#5D7B9D" Font-Bold="True" ForeColor="White" />
                <PagerStyle BackColor="#284775" ForeColor="White" HorizontalAlign="Center" />
                <SelectedRowStyle BackColor="#E2DED6" Font-Bold="True" ForeColor="#333333" />
                <HeaderStyle BackColor="#5D7B9D" Font-Bold="True" ForeColor="White" />
                <EditRowStyle BackColor="#999999" />
                <AlternatingRowStyle BackColor="White" ForeColor="#284775" />
                <Columns>
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
                </Columns>
            </asp:GridView>
            <asp:Panel ID="Panel6" runat="server" BackColor="#CCCCCC" Height="40px">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <asp:Button ID="GetLogBtn" runat="server" Height="30px" 
                    style="margin-top: 5px; margin-bottom: 1px" Text="Get Log Data" 
                    Width="200px" onclick="GetLogBtn_Click" />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <asp:Button ID="ClearBtn" runat="server" Height="30px" Text="Clear Log Data" 
                    Width="200px" onclick="ClearBtn_Click" />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<asp:TextBox ID="mTransIdTxt" runat="server" Visible="False"></asp:TextBox>
        </asp:Panel>
            <asp:Panel ID="Panel5" runat="server" BorderStyle="Groove" Height="44px" 
                style="margin-top: 11px" BackColor="#EEEEEE">
                &nbsp;
                <asp:Label ID="Label9" runat="server" Font-Size="Large" Text="Status"></asp:Label>
                <br />
                &nbsp; &nbsp;&nbsp;&nbsp;
                <asp:Label ID="StatusTxt" runat="server"></asp:Label>
                

            </asp:Panel>
           
               
             <asp:timer ID="Timer" runat="server" Interval="1000" OnTick="Timer_Watch" 
                    Enabled="False"></asp:timer>
        </ContentTemplate>
        </asp:UpdatePanel>
    </form>
</body>
</html>
