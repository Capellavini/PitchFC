import {normalizeSquad} from './fantasyDemo.js';
// Normalize bench size while requiring an explicit captain/vice choice in the UI.
export function prepareFanSquad({playerIds,reserveIds,captainId,viceId,connection}){
 return {...normalizeSquad({playerIds,reserveIds,captainId,viceId},5),connection};
}
