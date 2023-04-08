//simulation settings
var settingsJson = {
  direction: "send", //send/receive
  service: "iothub", //iothub/eventhub/servicebus/mqtt
  messageBodyTemplate: null,
  messageHeaderTemplate: null,
  messagePropertiesTemplate: null,
  placeholders: [],
  connection: {},
  protocol: "http", //mqtt/amqp/mqttws/amqpws/http - htt now and will add more in future
  delay: 10,
  batch: 1,
  count: 0,
  bulkSend: false
};

//simulation flag
var simulationInProgress = false;

//when the document is ready
$(function () {

  //direction button click binding
  $("input[type=radio][name=dirOption]").on("change", directionButtonClickHandler);

  //service button click binding
  $("input[type=radio][name=servOption]").on("change", serviceButtonClickHandler);

  //placeholders refresh button click binding
  $("#placehold_gen_btn").on("click", placeholderGenButtonClickHandler);

  //start button click event
  $("#cntl_start_btn").on("click", startButtonClickHandler);

  //stop button click event
  $("#cntl_stop_btn").on("click", stopButtonClickHandler);

  //view generated message button
  $("#cntl_preview_btn").on("click", previewButtonClickHandler);

  //tab button click event
  $(".tab-head").on("click", (e) => tabHeadButtonClickHandler(e));

  //notification close click event
  $("#deleteNotification").on("click", closeNotificationButtonClickHandler);

  //clear log button click event
  $("#cntl_clear_btn").on("click", clearLogButtonClickHandler);

  //hide unhide button click event
  $("#cntl_hide_btn").on("click", hideButtonClickHandler);
});



//on log update trigger
window.api.onLogUpdate((_event, message, type) => {
  printLogMessage(message, type);
});


//on count update trigger
window.api.onCountUpdate((_event, countObj) => {
  $("#count_success_lbl").text(countObj.success);
  $("#count_fail_lbl").text(countObj.failure);
  $("#count_total_lbl").text(countObj.total);
});

//-----------------------------------------------------
//-----------------HIDE BUTTON-------------------------
//-----------------------------------------------------
async function hideButtonClickHandler() {
  if ($("#cntl_hide_img").attr("src").endsWith("unhide_icon.png")) {
    $("#cntl_hide_img").attr("src", "../assets/images/hide_icon.png");
    $("#templateSection").removeClass("hidden");
  }
  else {
    $("#cntl_hide_img").attr("src", "../assets/images/unhide_icon.png");
    $("#templateSection").addClass("hidden");
  }
}



//-----------------------------------------------------
//-----------------CLEAR LOG BUTTON-----------
//-----------------------------------------------------
async function clearLogButtonClickHandler() {
  $("#logDisplay").text("");
}



//-----------------------------------------------------
//-----------------NOTIFICATION CLOSE BUTTON-----------
//-----------------------------------------------------
async function closeNotificationButtonClickHandler() {
  $("#log_msg_lbl").parent().addClass("hidden");
}


//-----------------------------------------------------
//-----------------VIEW BUTTON-------------------------
//-----------------------------------------------------
async function previewButtonClickHandler() {

  //prepare settings object
  prepareSettings();


  //validate the settings provided
  let validationRes = validateSettings("generate");

  if (validationRes == false)
    return;

  //invoke main service to get generated message
  const genMessage = await window.api.getGeneratedMessage(settingsJson);

  //print generated header message as log
  if (genMessage.header != null)
    printLogMessage(JSON.stringify(genMessage.header), "info");

  //print generated message as log
  printLogMessage(genMessage.message, "info");

}

//-----------------------------------------------------
//-----------------PLACEHOLDER GEN BUTTON--------------
//-----------------------------------------------------
function placeholderGenButtonClickHandler() {


  //prepare settings object
  prepareSettings();

  //get the template content
  const templateString = settingsJson.messageBodyTemplate
    + " " + settingsJson.messageHeaderTemplate
    + " " + settingsJson.messagePropertiesTemplate;

  //validate the settings provided
  let validationRes = validateSettings("placeholderGenerate");

  if (validationRes == false)
    return;

  //get placeholder strings from the template
  const placeholders = templateString
    .match(/\{\{(.+?)\}\}/g)
    .map((placeholder) => placeholder.replace(/[{}]/g, ""));

  //iterate through all placeholders
  placeholders.forEach((placeholder) => {

    //assign default placeholder generation method
    const phType = "stringRandom";

    //check if the placeholder is already present
    if ($("#ph_" + placeholder).length) return;

    //create a new div element to placed with placeholder card template
    const childElement = document.createElement("div");

    //append the placeholder card with placeholder name
    childElement.innerHTML = phCardTemplate.replaceAll(
      "{{placeholderName}}",
      placeholder
    );
    //adding the child
    $("#placeholderWrap").append(childElement);

    //adding the change event to drop down
    $("#ph_opt_" + placeholder + "_sel").change(genOptionDropdownClickHandler);

    //prepare placeholder object for adding to list
    var phObj = {
      id: placeholder,
      type: phType,
    };

    //update params within placeholder
    updatePlaceholderGenParams(placeholder, phType);

    //adding the placeholder to config
    settingsJson.placeholders.push(phObj);
  });
}

//-----------------------------------------------------
//---PLACEHOLDER GEN OPTION DROPDOWN SELECT------------
//-----------------------------------------------------
function genOptionDropdownClickHandler() {

  //get the selected type
  var type = $("option:selected", this).val();

  //get the placeholder name
  const phName = $(this).data("name");

  //get the placeholder index from the settings json
  objIndex = settingsJson.placeholders.findIndex((obj) => obj.id == phName);

  //update the configuration
  settingsJson.placeholders[objIndex].type = type;

  //update params within placeholder
  updatePlaceholderGenParams(phName, type);
}


//-----------------------------------------------------
//-----------------TAB BUTTONS-------------------
//-----------------------------------------------------
function tabHeadButtonClickHandler(e) {

  //remove highlighted class from all buttons
  $(".tab-head").parent().removeClass("is-active");

  //add highlighted class to current button
  $("#" + e.target.id).parent().addClass("is-active");

  //display respective tab content
  $(".tab-content").hide();
  $("#" + e.target.id + "_content").show();

}



//-----------------------------------------------------
//-----------------DIRECTION RADIO BUTTONS-------------
//-----------------------------------------------------
function directionButtonClickHandler() {

  //get the button text as the chosen direction
  settingsJson.direction = $("input[type=radio][name=dirOption]:checked").val();

  //update the connection settings params
  updateConSettingsGenParams(settingsJson.service, settingsJson.direction);

}

//-----------------------------------------------------
//-----------------SERVICES BUTTONS--------------------
//-----------------------------------------------------
function serviceButtonClickHandler() {


  //get the button text as the chosen direction and remove spaces in it
  settingsJson.service = $("input[type=radio][name=servOption]:checked").val();

  //update the connection settings params
  updateConSettingsGenParams(settingsJson.service, settingsJson.direction);
}


//-----------------------------------------------------
//-----------------START BUTTON------------------------
//-----------------------------------------------------
async function startButtonClickHandler() {

  //check already existing simulation
  if (simulationInProgress == true)
    return

  //prepare settings object
  prepareSettings();

  //validate the settings provided
  let validationRes = validateSettings(settingsJson.direction);

  //check the validation is fine
  if (validationRes == false)
    return;

  //removing the attribute will show a flowing progress bar on screen
  $("#cntl_progress").removeAttr("value");

  //in progress flag
  simulationInProgress = true;

  //invoke main service to start simulation
  if (settingsJson.direction == "send" && settingsJson.service == "iothub")
    await window.api.startIoTHubSimulation(settingsJson);
  else if (settingsJson.direction == "receive" && settingsJson.service == "iothub")
    await window.api.startIoTHubSubscription(settingsJson);
  else if (settingsJson.direction == "send" && settingsJson.service == "eventhub")
    await window.api.startEventHubSimulation(settingsJson);
  else if (settingsJson.direction == "receive" && settingsJson.service == "eventhub")
    await window.api.startEventHubSubscription(settingsJson);

  //setting 0 will disable the continuous flow of progress bar
  $("#cntl_progress").attr("value", 0);

  //in progress flag
  simulationInProgress = false;
}


//-----------------------------------------------------
//-----------------STOP BUTTON-------------------------
//-----------------------------------------------------
async function stopButtonClickHandler() {

  //invoke main service to start simulation
  if (settingsJson.direction == "send" && settingsJson.service == "iothub")
    await window.api.stopIoTHubSimulation(settingsJson);
  else if (settingsJson.direction == "receive" && settingsJson.service == "iothub")
    await window.api.stopIoTHubSubscription(settingsJson);
  else if (settingsJson.direction == "send" && settingsJson.service == "eventhub")
    await window.api.stopEventHubSimulation(settingsJson);
  else if (settingsJson.direction == "receive" && settingsJson.service == "eventhub")
    await window.api.stopEventHubSubscription(settingsJson);

}

function printLogMessage(logMessage, type) {
  //check the message view enabled
  if (type == "message" && $("#log_msg_check").prop("checked") == false) return;
  //check the details view enabled
  else if (type == "details" && $("#log_detail_check").prop("checked") == false)
    return;
  //adding the message to log
  $("#logDisplay").append(
    //generatedString.replace(/\r\n|\r|\n/g, "") + "\r\n"
    Date.now() + " : " + logMessage + "\r\n"
  );
  //scroll the log section to bottom
  if ($("#log_scroll_check").prop("checked")) {
    $("#logDisplay").scrollTop($("#logDisplay")[0].scrollHeight);
  }
}




//-----------------------------------------------------------------
//------------------common services--------------------------------
//-----------------------------------------------------------------



//print message
function printMessage(message, type) {

  if (type == "error") {
    //$("#log_msg_lbl").addClass("has-text-danger-dark");
  }
  else if (type == "info") {
    //$("#log_msg_lbl").addClass("has-text-info-dark");
  }
  else if (type == "clear") {
    //$("#log_msg_lbl").text("");
    $("#log_msg_lbl").text("&nbsp;");
    $("#log_msg_lbl").parent().addClass("hidden");
    return;
  }
  $("#log_msg_lbl").text(message);
  $("#log_msg_lbl").parent().removeClass("hidden");
}



//update placeholder generation items parameters
function updatePlaceholderGenParams(phName, type) {

  //get the placeholder index from the settings json
  phGenObjIndex = phGenOptions.findIndex((obj) => obj.name == type);

  //check if both param1 and param 2 is not available, 
  //in that case, the parent wrap will be hidden
  phGenOptions[phGenObjIndex].param1 == null && phGenOptions[phGenObjIndex].param2 == null
    ? $("#ph_" + phName + "_txt1").parent().parent().hide()
    : $("#ph_" + phName + "_txt1").parent().parent().show();

  phGenOptions[phGenObjIndex].param3 == null
    ? $("#ph_" + phName + "_txt3").parent().parent().hide()
    : $("#ph_" + phName + "_txt3").parent().parent().show();

  $("#ph_" + phName + "_txt1").attr("placeholder", phGenOptions[phGenObjIndex].param1);
  $("#ph_" + phName + "_txt2").attr("placeholder", phGenOptions[phGenObjIndex].param2);
  $("#ph_" + phName + "_txt3").attr("placeholder", phGenOptions[phGenObjIndex].param3);
}


//update connection settings generation items parameters
function updateConSettingsGenParams(service, direction) {

  //get the placeholder index from the json
  objIndex = conSettingGenOptions.findIndex((obj) => obj.name == service && obj.direction == direction);

  //check if both param2 is avaiable or not, param 1 will always be availablee, 
  conSettingGenOptions[objIndex].param2 == null
    ? $("#con_string_lbl2").parent().hide()
    : $("#con_string_lbl2").parent().show();

  conSettingGenOptions[objIndex].param3 == null
    ? $("#con_string_lbl3").parent().hide()
    : $("#con_string_lbl3").parent().show();

  conSettingGenOptions[objIndex].param4 == null
    ? $("#con_string_lbl4").parent().hide()
    : $("#con_string_lbl4").parent().show();

  conSettingGenOptions[objIndex].param5 == null
    ? $("#con_string_lbl5").parent().hide()
    : $("#con_string_lbl5").parent().show();

  $("#con_string_txt1").attr("placeholder", conSettingGenOptions[objIndex].param1);
  $("#con_string_txt2").attr("placeholder", conSettingGenOptions[objIndex].param2);
  $("#con_string_txt3").attr("placeholder", conSettingGenOptions[objIndex].param3);
  $("#con_string_txt4").attr("placeholder", conSettingGenOptions[objIndex].param4);
  $("#con_string_txt5").attr("placeholder", conSettingGenOptions[objIndex].param5);

}


//get the settings ready
function prepareSettings() {
  //updating connection settings
  settingsJson.connection = {
    connectionPram1: getValueInType($("#con_string_txt1").val(), "string", null),
    connectionPram2: getValueInType($("#con_string_txt2").val(), "string", null),
    connectionPram3: getValueInType($("#con_string_txt3").val(), "string", null),
    connectionPram4: getValueInType($("#con_string_txt4").val(), "string", null),
    connectionPram5: getValueInType($("#con_string_txt5").val(), "string", null)
  };

  //updating message template 
  settingsJson.messageBodyTemplate = getValueInType($("#msg_body_txt").val(), "string", null);
  //updating header template
  settingsJson.messageHeaderTemplate = getValueInType($("#msg_header_txt").val(), "string", null);
  //updating properties template
  settingsJson.messagePropertiesTemplate = getValueInType($("#msg_prop_txt").val(), "string", null);
  //updating delay settings
  settingsJson.delay = getValueInType($("#set_delay_txt").val(), "int", 10);
  //updating batch size settings
  settingsJson.batch = getValueInType($("#set_batch_txt").val(), "int", 1);
  //updating fixed count settings
  settingsJson.count = getValueInType($("#set_count_txt").val(), "int", 0);
  //bulk send option
  settingsJson.bulkSend = $("#set_bulk_check").prop("checked") == true;
  //update placeholder generation parameters to settings
  //loop though the placeholders
  for (var i = 0; i < settingsJson.placeholders.length; i++) {
    settingsJson.placeholders[i].param1 = getValueInType($("#ph_" + settingsJson.placeholders[i].id + "_txt1").val(), "string", null);
    settingsJson.placeholders[i].param2 = getValueInType($("#ph_" + settingsJson.placeholders[i].id + "_txt2").val(), "string", null);
    settingsJson.placeholders[i].param3 = getValueInType($("#ph_" + settingsJson.placeholders[i].id + "_txt3").val(), "string", null);
  }

}


//validate the settings provided
function validateSettings(methodName) {

  if ((methodName == "send" || methodName == "generate")
    && settingsJson.messageBodyTemplate == null) {
    printMessage("Please provide valid message body", "error");
    return false;
  }
  else if ((methodName == "send" || methodName == "generate")
    && settingsJson.messageBodyTemplate.includes("{{")
    && settingsJson.placeholders.length == 0) {
    printMessage("Please generate placeholders", "error");
    return false;
  }
  else if ((methodName == "send" || methodName == "receive")
    && settingsJson.connection.connectionPram1 == null) {
    printMessage("Please provide valid connection string", "error");
    return false;
  }
  if ((methodName == "placeholderGenerate")
    && settingsJson.messageBodyTemplate == null
    && settingsJson.messageHeaderTemplate == null
    && settingsJson.messagePropertiesTemplate == null) {
    printMessage("Please provide valid message body", "error");
    return false;
  }

  printMessage("", "clear");
  return true;

}



//get value from the parameter string
function getValueInType(value, type, defaultValue = null) {
  if (type == "int") {
    return value != null && value.trim() != "" ? parseInt(value) : defaultValue
  }
  else if (type == "float") {
    return value != null && value.trim() != "" ? parseFloat(value) : defaultValue
  }
  else {
    return value != null && value.trim() != "" ? value.trim() : defaultValue
  }
}

//placeholder card template
const phCardTemplate = `
<div class="card mb-2" id="ph_{{placeholderName}}">
  <div class="card-content p-2">
    <div class="columns mb-0">
      <div class="column is-6">
        <div class="label pt-2">{{placeholderName}}</div>
      </div>
      <div class="column is-6">
        <div class="select is-fullwidth">
          <select id="ph_opt_{{placeholderName}}_sel" data-name="{{placeholderName}}">
            <!-- string -->
            <option value="stringRandom" selected>String-Random</option>
            <option value="stringRandomList">String-RandomList</option>
            <option value="stringSequenceList">String-SequenceList</option>
            <!-- int -->
            <option value="integerRandom">Integer-Random</option>
            <option value="integerRandomList">Integer-RandomList</option>
            <option value="integerSequenceList">Integer-SequenceList</option>
            <option value="integerStepBy">Integer-StepBy</option>
            <!-- double -->
            <option value="doubleRandom">Double-Random</option>
            <option value="doubleRandomList">Double-RandomList</option>
            <option value="doubleSequenceList">Double-SequenceList</option>
            <option value="doubleStepBy">Double-StepBy</option>
            <!-- bool -->
            <option value="booleanRandom">Boolean-Random</option>
            <option value="booleanSequenceList">Boolean-SequenceList</option>
            <!-- guid -->
            <option value="guid">Guid</option>
            <!-- time -->
            <option value="timeInUtc">Time-InUtc</option>
            <option value="timeInLocal">Time-InLocal</option>
            <option value="timeInEpoch">Time-InEpoch</option>
            <option value="timeInEpochMilli">Time-InEpochMilli</option>
          </select>
        </div>
      </div>
    </div>
    <div class="columns mb-0">
      <div class="column is-6">
        <input class="input" id="ph_{{placeholderName}}_txt1" type="text" placeholder="Min" />
      </div>
      <div class="column is-6">
        <input class="input" id="ph_{{placeholderName}}_txt2" type="text" placeholder="Max" />
      </div>
    </div>
    <div class="columns mb-0">
      <div class="column is-12">
        <input class="input" id="ph_{{placeholderName}}_txt3" type="text" placeholder="List" />
      </div>
    </div>
  </div>          
  </div>
  `;

//connection settings generation options
var conSettingGenOptions = [
  {
    name: "iothub",
    direction: "send",
    param1: "Device connection string"
  },
  {
    name: "eventhub",
    direction: "send",
    param1: "Event hub connection string"
  },
  {
    name: "servicebus",
    direction: "send",
    param1: "Service bus connection string",
    param2: "Topic name"
  },
  {
    name: "mqtt",
    direction: "send",
    param1: "mqtt connection string"
  },
  {
    name: "iothub",
    direction: "receive",
    param1: "Device connection string"
  },
  {
    name: "eventhub",
    direction: "receive",
    param1: "Event hub namespace connection string",
    param2: "Event hub name",
    param3: "Consumer group name",
    param4: "Storage account connection string",
    param5: "Storage account container name"
  },
  {
    name: "servicebus",
    direction: "receive",
    param1: "Service bus connection string",
    param2: "Topic name"
  },
  {
    name: "mqtt",
    direction: "receive",
    param1: "mqtt connection string"
  }
]

//place golder params generation options
var phGenOptions = [
  {
    name: "stringRandom",
    param1: "Min length",
    param2: "Max length",
  },
  {
    name: "stringRandomList",
    param3: "List - Comma separated string",
  },
  {
    name: "stringSequenceList",
    param3: "List - Comma separated string",
  },
  {
    name: "integerRandom",
    param1: "Minimum",
    param2: "Maximum",
  },
  {
    name: "integerRandomList",
    param3: "List - Comma separated integer",
  },
  {
    name: "integerSequenceList",
    param3: "List - Comma separated integer",
  },
  {
    name: "integerStepBy",
    param1: "Starts with",
    param2: "Increment by",
  },
  {
    name: "doubleRandom",
    param1: "Minimum",
    param2: "Maximum",
  },
  {
    name: "doubleRandomList",
    param3: "List - Comma separated integer",
  },
  {
    name: "doubleSequenceList",
    param3: "List - Comma separated integer",
  },
  {
    name: "doubleStepBy",
    param1: "Starts with",
    param2: "Increment by",
  },
  {
    name: "booleanRandom",
  },
  {
    name: "booleanSequenceList",
    param3: "List - Comma separated true or false",
  },
  {
    name: "guid",
  },
  {
    name: "timeInUtc",
    param3: "Date format",
  },
  {
    name: "timeInLocal",
    param3: "Date format",
  },
  {
    name: "timeInEpoch",
  },
  {
    name: "timeInEpochMilli",
  },
  //wil be considering EVAL in future only
  // {
  //   name: "advanced",
  //   param3: "Your EVAL statement",
  // },
];
