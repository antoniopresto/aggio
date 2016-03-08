import DataStore from '../../index'
import { AsyncStorage } from './reactNativeMock'

export const getDb = async () => {
  AsyncStorage.__reset()
  const db = new DataStore({ filename: 'foo' })
  await db.loadDatabaseAsync()
  return db
}
