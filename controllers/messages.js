var dal         				= require('../data_access/dal');
var authenticate         		= require('./authenticate');

var methods = {};



methods.sendMessage = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		//Get the parameters from the body of the HTTP POST message
		var providedConversationId = request.body.conversationId;
		var providedMessage = request.body.message;
		
		function get_conversation_by_iD_callback(err, rows, fields)
		{
			if (err)
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else if(rows.length === 0)
			{ 
				response.status(500).send({success: false, msg: 'This conversation does not exist.'});
			}
			else
			{
				//The conversation exists, so there should be two rows returned.
				//Check to make sure that one of these two rows represents the sender.
				if(rows[0].internalUserId === internalUserId || rows[1].internalUserId === internalUserId)
				{
					response.send({success: true, msg: 'Your message has been sent.'});
				}
				else
				{
					response.status(403).send({success: false, msg: 'This user does not have access to this conversation.'});
				}
			}
		}
		
		//First, get the specified conversation and ensure that this user is part of that conversation.
		dal.get_conversation_by_iD(connection, get_conversation_by_iD_callback, providedConversationId);
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}



module.exports = methods;