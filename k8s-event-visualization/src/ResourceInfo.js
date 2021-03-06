import axios from 'axios';
import React from "react";
import {
    Typography,
    AppBar,
    Toolbar,
    TextField,
    Select,
    MenuItem
  } from "@material-ui/core";
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import EventsTable from './EventsTable';
import { withRouter } from 'react-router-dom';
import moment from 'moment';
import { SquareLoader } from "react-spinners";
import EventsGraph from './EventsGraph';



function timeAtHoursBefore(hours) {
  const date = new Date();
  let milis = date.getTime();
  const dateBefore = new Date();
  dateBefore.setHours(dateBefore.getHours() - hours);
  const difference = date.getTime() - dateBefore.getTime();
  return milis - difference;
}

const GRANULARITY_OPTIONS = ["1 minute", "10 minutes", "60 minutes", "1 day"]

class ResourceInfo extends React.Component {
    constructor(props) {
        super(props);
        var urlParams = new URLSearchParams(window.location.search);
        this.state = {
            resourceName: urlParams.get('name'),
            events: [],
            timeStart: timeAtHoursBefore(2),
            timeEnd: new Date().getTime(),
            loading: true,
            granularity: GRANULARITY_OPTIONS[0]
        }
        this.changeStartTime = this.changeStartTime.bind(this);
        this.changeEndTime = this.changeEndTime.bind(this);
    }

    componentDidMount() {
      this.getResourceEvents();
      const _this = this;
      setInterval(function(){ _this.getResourceEvents(); }, 15000);
    }

    getResourceEvents() {
      const config = {
        headers: {
          Authorization:
          "ApiKey " + process.env.REACT_APP_ROCKSET_API_KEY
        }
      };
      const body = {
        sql: {
          query: `SELECT e.event.involvedObject.name, e.verb, e.event.reason, e.event.message, e.event.lastTimestamp FROM commons.eventrouter_events e
                    WHERE e.event.involvedObject.name = '${this.state.resourceName}'
                    AND UNIX_MILLIS(PARSE_TIMESTAMP_ISO8601(e.event.lastTimestamp)) > ${this.state.timeStart}
                    AND UNIX_MILLIS(PARSE_TIMESTAMP_ISO8601(e.event.lastTimestamp)) < ${this.state.timeEnd}
                    ORDER BY UNIX_MILLIS(cast(e.event.lastTimestamp as timestamp)) DESC
          `
        }
      };
      axios
        .post(
          "https://api.rs2.usw2.rockset.com/v1/orgs/self/queries",
          body,
          config
        )
        .then(response => {
          this.setState({loading: false})
          let data = response.data;
          this.setState({ events: data["results"] });
        })
        .catch(error => {
          console.log(error);
        });
    }

  changeStartTime(e) {
    this.setState({timeStart: Date.parse(e.target.value), loading: true}, () => {
      this.getResourceEvents();
    });
  }
  changeEndTime(e) {
    this.setState({timeEnd: Date.parse(e.target.value), loading: true}, () => {
      this.getResourceEvents();
    });
  }

  dateToSelectorString(dateSeconds) {
    const start = new Date(dateSeconds)
    return moment(start).format("YYYY-MM-DDTHH:mm")
  }


  render() {
    const {resourceName, timeStart, timeEnd, events, granularity} = this.state;
    const startStr = this.dateToSelectorString(timeStart);
    const endStr = this.dateToSelectorString(timeEnd);
    return (
      <div>
        <AppBar position="static">
        <Toolbar>
          <ChevronLeft style={{"transform": "scale(1.8)", paddingRight: '20px'}} onClick={() => this.props.history.goBack()}/>
          <Typography variant="h3"> {resourceName} </Typography>
        </Toolbar>
      </AppBar>
        <div>
          <div style={{"padding":'10px'}}>
            <Typography variant="h6"> Filter events by time </Typography>
            <TextField
              id="datetime-local"
              label="Start time"
              type="datetime-local"
              defaultValue={startStr}
              InputLabelProps={{
                shrink: true,
              }}
              onChange={this.changeStartTime}
            />
            <TextField
              id="datetime-local"
              label="End time"
              type="datetime-local"
              defaultValue={endStr}
              InputLabelProps={{
                shrink: true,
              }}
              style={{"marginLeft": '50px'}}
              onChange={this.changeEndTime}
            />
          </div>
          {this.state.loading ?
            <div style={{"paddingLeft" :"50%", paddingTop: "20%"}}>
              <SquareLoader size={150} color={"#3f51b5"}/>
            </div>
           : 
           <div>
             {events.length === 0 ? 
             <Typography variant="h6"> No events in this time range for the resource. Try selecting a different timeline. </Typography>
             :
             <div>
              <EventsTable events={[this.state.events[0]]} mostRecent={true}/>
              <Typography variant="h6" style={{"padding": "10px"}}> Event Granularity </Typography>
              <Select style={{"width": "200px", "marginLeft": "10px"}} value={granularity} onChange={e => this.setState({ granularity: e.target.value })}>
                {GRANULARITY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}> {option} </MenuItem>
                ))}
              </Select>
              <EventsGraph events={this.state.events} granularity={granularity}/>
              <Typography variant="h6" style={{"padding": "10px"}}> All Events In Time Range </Typography>
              <EventsTable events={this.state.events}/>
              </div>
            }
             </div>
          }
        </div>
      </div>
    );
  }
}

export default withRouter(ResourceInfo);