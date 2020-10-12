require('ical-expander');
require('@fullcalendar/core');
require('@fullcalendar/daygrid');
require('@fullcalendar/interaction');
require('@fullcalendar/rrule');
require('@fullcalendar/list');
require('@fullcalendar/timegrid');

require('store2');
require('superagent');
const IcalExpander = require('ical-expander');
require('@popperjs/core');
require('ismobilejs');

import isMobile from 'ismobilejs';
import { createPopper } from '@popperjs/core';
import superagent from 'superagent';
import store from 'store2';
import { Calendar } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import rrulePlugin from '@fullcalendar/rrule';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';


document.addEventListener('DOMContentLoaded', function() {
  var GRAV_PLUGIN_CONFIG = GRAV.config.plugins.fullcalendar;
  var verbose = GRAV.config.system.debugger.enabled || false;
  //demo calendars
  var demoCalendars = GRAV_PLUGIN_CONFIG.calendars;
  var calendarHtmlTarget = GRAV_PLUGIN_CONFIG.fullcalendar.target || '#calendar';
  var calendarsConfig = [];
  var allevents = [];

  //responsive
  var initialView = GRAV_PLUGIN_CONFIG.fullcalendar.initialView;
  if (isMobile.any) {
    initialView = 'listWeek';
  }

  //init cache 
  store.remove('events');

  //ics from page frontmatter 
  if(GRAV.page.header.calendars) {
    calendarsConfig = GRAV.page.header.calendars;
  }

  //ics files uploaded in calendar page
  if (GRAV.page.media) {
    let media = GRAV.page.media;
    media.forEach((file, id)=>{
        calendarsConfig.push({"ics": file.ics , "name": file.name, "active": true, color: GRAV_PLUGIN_CONFIG.colors[id] });
    });
  }

  //ics demo 
  if (!calendarsConfig) {
    calendarsConfig = demoCalendars;
  } 

  var showlegend = GRAV_PLUGIN_CONFIG.showlegend || false;

  // page is now ready, initialize the calendar...
  var calendarEl = document.querySelector(calendarHtmlTarget);
  var calendar = new Calendar(calendarEl, {

    /* Configuration */

    plugins: [ interactionPlugin, listPlugin, dayGridPlugin, rrulePlugin, timeGridPlugin ],
    initialView: initialView,
    locale: GRAV_PLUGIN_CONFIG.fullcalendar.locale || 'en',
    weekNumbers: GRAV_PLUGIN_CONFIG.fullcalendar.weekNumbers || false,
    timeZone: GRAV_PLUGIN_CONFIG.fullcalendar.timezone || 'local',
    headerToolbar: {
      right: 'dayGridMonth,timeGridWeek,listWeek',
      left: 'prevYear,prev,next,nextYear today',
      center: 'title',
    },
    firstDay: 1,
    navLinks: GRAV_PLUGIN_CONFIG.fullcalendar.navLinks || false,
    editable: GRAV_PLUGIN_CONFIG.fullcalendar.editable || false,
    fixedWeekCount: GRAV_PLUGIN_CONFIG.fullcalendar.fixedWeekCount || false,
    contentHeight: GRAV_PLUGIN_CONFIG.fullcalendar.contentHeight || 'auto',
    slotMinTime: GRAV_PLUGIN_CONFIG.fullcalendar.slotMinTime || '07:00:00',
    slotMaxTime: GRAV_PLUGIN_CONFIG.fullcalendar.slotMaxTime || '24:00:00',

    /* methods */

    eventDidMount: function(info) { 
      if (!GRAV_PLUGIN_CONFIG.tooltip) {
        return;
      }
      let tooltipContent = [];
      let description = info.event.extendedProps.description
      if (description) {  
        tooltipContent.push(description.split("\n").join("<br />"));
      }
      let location = info.event.extendedProps.location;
      if (location) {
        tooltipContent.push(location);
      }
      let tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.innerHTML = tooltipContent.join('<br />');
      info.el.appendChild(tooltip);
      let button = document.createElement('button');
      button.className = 'button';
      button.style.display = 'none';
      button.setAttribute('role', 'button');
      info.el.appendChild(button);
     
      /*
       createPopper(tooltip, button, {
              title: info.event.extendedProps.description,
              placement: 'right',
              trigger: 'hover',
            });
            */
    },

    events: function(info, successCallback, failureCallback) {
      //load events from cache
      allevents = store.get('events') || [];
      if (allevents != null && allevents.length > 0) {
        console.log('[FULLCALENDAR PLUGIN] events loaded from cache');
        successCallback(allevents);
        allevents=[];
        return;
      }

      calendarsConfig.forEach((calendarConfig, index)=> {
        if (!calendarConfig.active) {
          console.log("Calendar " + calendarConfig.name + " is inactive" );
          return;
        }
        var calendarUrl = ''+ calendarConfig.ics;
        //allow remote ics files, full URL required
        if (calendarUrl.startsWith("https://") || calendarUrl.startsWith("http://")) {  // calendar URL is remote
          //automatically add CORS proxy URL for remote calendars, if not yet done 06.04.20
          var origin = window.location.protocol + '//' + window.location.host;
          var cors_api_url = GRAV_PLUGIN_CONFIG.proxy;  // replace this if you prefer another CORS proxy !
          if (!calendarUrl.startsWith(origin)) {
            if (verbose) { 
              console.log('remote is different Origin, use proxy '+ cors_api_url);
            }
            calendarUrl = cors_api_url + calendarConfig.ics;
          }
        }
        if (verbose) {
          console.log( calendarConfig);
        }
        var events = [];
        var do_callback = false;
        if (index == (calendarsConfig.length - 1)) {
          do_callback = true;
        }
        if (verbose) {
          console.log('index,do_callback:', index, do_callback);
        }

        superagent.get(calendarUrl).end( (error, result) => {
          console.log('[grav-plugin-fullcalendar] loading ics file :' + calendarUrl);
          let data = new String(result.text);
          const icalExpander = new IcalExpander({ ics:data, maxIterations: 100});
          let events = icalExpander.all();
          //events
          let  mappedEvents = events.events.map(e => (
            { 
              start: e.startDate.toJSDate(), 
              end: e.endDate.toJSDate(),
              title: e.summary,
              uid: e.uid,
              url: e.url,
              color: calendarConfig.color,
              extendedProps : {
                description: e.description,
                location: e.location,
              },
            })
          );
          //occurences
          let mappedOccurrences = events.occurrences.map( function(o) { 
            let cpt = o.item.component;
            console.log(o);
            let occ = { 
              start: o.startDate.toJSDate(),
              end: o.endDate.toJSDate(),
              title: o.item.summary, 
              uid: o.uid,
              extendedProps : {
                description: cpt.getFirstPropertyValue("description"),
                location: cpt.getFirstPropertyValue("location"),
              },
              url: o.url,
              color: calendarConfig.color,
            }
            return occ;
          });

          events = [].concat(mappedEvents, mappedOccurrences);
          allevents = allevents.concat(events);

          if (do_callback) {
            successCallback(allevents);
            store.set('events', allevents);
            allevents=[];
          }

        });//endof superagent
      })//endof foreach
    }//endof events

    /* other callbacks */ 

  });//endof new Calendar

  calendar.render();

  // show legend, if enabled
  if (showlegend) {
    // Add the contents of cfgfiles to #legend:
    let legend = document.createElement('ul');
    calendarsConfig.forEach((calendarConfig, index)=>{
      let item = document.createElement('li');
      let name = document.createElement('span');
      name.innerHTML = calendarConfig.name;
      item.appendChild(name);
      if (calendarConfig.shareLink) { 
        let link = document.createElement('a');
        link.href = calendarConfig.shareLink;
        link.innerHTML = '+';
        item.appendChild(link);
      }
      let ics = document.createElement('a');
      ics.href = calendarConfig.ics;
      ics.innerHTML = 'ics';
      item.appendChild(ics);
      item.style.color = calendarConfig.color;
      legend.appendChild(item);
    }); 
    document.getElementById('legend').appendChild(legend);
  }

}); //endof eventlistener DOMLoaded

//@todo return prefix configured in grav cms
function getAbsolutePath() { // see https://www.sitepoint.com/jquery-current-page-url/
  var loc = window.location;
  var pathName = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
  return loc.href.substring(0, loc.href.length - ((loc.pathname + loc.search + loc.hash).length - pathName.length));
}


