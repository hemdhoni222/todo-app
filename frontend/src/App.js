import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Typography, Avatar, Chip } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TodoApp() {
  const { user, logout, login } = useAuth();
  const [todos, setTodos] = useState([]);
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [editingTodo, setEditingTodo] = useState(null);

  useEffect(() => {
    if (user) {
      fetchTodos();
      fetchUsers();
    } else {
      // Check for token in URL after Google OAuth
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        login(token);
        // Clear the token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [user, search, statusFilter, priorityFilter]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Error fetching users');
    }
  };

  const fetchTodos = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const response = await axios.get(`${API_URL}/api/todos?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTodos(response.data);
    } catch (error) {
      toast.error('Error fetching todos');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required');

    try {
      const todoData = {
        title,
        description,
        priority,
        dueDate,
        assignedTo: assignedUsers
      };

      if (editingTodo) {
        await axios.put(`${API_URL}/api/todos/${editingTodo._id}`, todoData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Todo updated successfully');
        setEditingTodo(null);
      } else {
        await axios.post(`${API_URL}/api/todos`, todoData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Todo added successfully');
      }

      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate(null);
      setAssignedUsers([]);
      fetchTodos();
    } catch (error) {
      toast.error(editingTodo ? 'Error updating todo' : 'Error adding todo');
    }
  };

  const toggleTodo = async (id) => {
    try {
      const todo = todos.find(t => t._id === id);
      await axios.put(`${API_URL}/api/todos/${id}`, 
        { completed: !todo.completed },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      toast.success('Todo status updated');
      fetchTodos();
    } catch (error) {
      toast.error('Error updating todo status');
    }
  };

  const deleteTodo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this todo?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/todos/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Todo deleted successfully');
      fetchTodos();
    } catch (error) {
      toast.error('Error deleting todo');
    }
  };

  const startEditing = (todo) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description);
    setPriority(todo.priority);
    setDueDate(todo.dueDate ? new Date(todo.dueDate) : null);
    setAssignedUsers(todo.assignedTo.map(user => user._id));
  };

  const cancelEditing = () => {
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate(null);
    setAssignedUsers([]);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="App">
        <ToastContainer position="top-right" autoClose={3000} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Todo List</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>Welcome, {user.name}</Typography>
            <Button variant="outlined" color="secondary" onClick={logout}>
              Logout
            </Button>
          </Box>
        </Box>
        
        <div className="filters">
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search todos..."
            className="search-input"
          />
          
          <FormControl className="filter-select">
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="incomplete">Incomplete</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl className="filter-select">
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Priority"
            >
              <MenuItem value="all">All Priorities</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
        </div>

        <form onSubmit={handleSubmit} className="todo-form">
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              label="Priority"
            >
              <MenuItem value="low">Low Priority</MenuItem>
              <MenuItem value="medium">Medium Priority</MenuItem>
              <MenuItem value="high">High Priority</MenuItem>
            </Select>
          </FormControl>
          
          <DatePicker
            label="Due Date"
            value={dueDate}
            onChange={setDueDate}
            renderInput={(params) => <TextField {...params} fullWidth />}
          />

          <FormControl fullWidth>
            <InputLabel>Assign To</InputLabel>
            <Select
              multiple
              value={assignedUsers}
              onChange={(e) => setAssignedUsers(e.target.value)}
              label="Assign To"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const user = users.find(u => u._id === value);
                    return (
                      <Chip
                        key={value}
                        label={user?.name}
                        avatar={user?.avatar ? <Avatar src={user.avatar} /> : null}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
            >
              {editingTodo ? 'Update Todo' : 'Add Todo'}
            </Button>
            {editingTodo && (
              <Button
                type="button"
                variant="contained"
                color="error"
                onClick={cancelEditing}
                fullWidth
              >
                Cancel
              </Button>
            )}
          </Box>
        </form>

        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo._id} className={`todo-item priority-${todo.priority}`}>
              <div className="todo-content">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo._id)}
                />
                <div className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                  <Typography variant="h6">{todo.title}</Typography>
                  <Typography variant="body2">{todo.description}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip
                      label={todo.priority}
                      color={
                        todo.priority === 'high' ? 'error' :
                        todo.priority === 'medium' ? 'warning' : 'success'
                      }
                      size="small"
                    />
                    {todo.dueDate && (
                      <Chip
                        label={new Date(todo.dueDate).toLocaleDateString()}
                        color={new Date(todo.dueDate) < new Date() ? 'error' : 'default'}
                        size="small"
                      />
                    )}
                  </Box>
                  {todo.assignedTo?.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                      {todo.assignedTo.map(user => (
                        <Chip
                          key={user._id}
                          avatar={user.avatar ? <Avatar src={user.avatar} /> : null}
                          label={user.name}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </div>
              </div>
              <div className="todo-actions">
                <Button
                  onClick={() => startEditing(todo)}
                  variant="contained"
                  color="primary"
                  size="small"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => deleteTodo(todo._id)}
                  variant="contained"
                  color="error"
                  size="small"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LocalizationProvider>
  );
}

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={user ? <TodoApp /> : <Navigate to="/login" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
